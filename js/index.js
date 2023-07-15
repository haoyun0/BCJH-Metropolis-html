$(function() {
  var app = new Vue({
    el: '#main',
    data: {
      uri: 'https://bcjh.xyz/api',
      log: [],
      form: {},
      userId: null,
      rules: [],
      disable: false,
      ruleId: null,
      passline: null,
      iterChef: 5000,
      iterRep: 1000,
      userCfg: {},
      rule: {},
      scores: [],
      results: [],
      resultsDeatil: [],
      showDetail: false,
      rstShowId: -1,
      threadCnt: 0,
      cpuCnt: 0,
      allowTool: true
    },
    mounted() {
      let that = this;
      that.getRule();
      that.cpuCnt = window.navigator.hardwareConcurrency || 8;
      that.getUserCfg();
    },
    methods: {
      getUserCfg() {
        let userCfg = window.localStorage.getItem('userCfg');
        if (userCfg) {
          this.userCfg = JSON.parse(userCfg);
          this.passline = this.userCfg.passline || this.passline;
          this.iterChef = this.userCfg.iterChef || this.iterChef;
          this.iterRep = this.userCfg.iterRep || this.iterRep;
          this.threadCnt = this.userCfg.threadCnt || this.cpuCnt;
          this.allowTool = this.userCfg.allowTool == undefined ? this.allowTool : this.userCfg.allowTool;
        } else {
          this.threadCnt = this.cpuCnt;
        }
      },
      getRule() {
        let that = this;
        $.ajax({
          url: `${that.uri}/get_banquet_rule`,
          type: 'GET'
        }).then(rst => {
          if (!rst) {
            that.$message({
              message: '没有获取到宴会规则！',
              type: 'error'
            });
          } else {
            that.rules = rst.rules;
            that.intents = rst.intents;
            that.buffs = rst.buffs;
            that.ruleId = rst.rules[0].id;
          }
        });
      },
      doRun() {
        if (!this.passline || !this.iterChef || !this.iterRep) {
          this.$message({
            message: '请填写必填项',
            type: 'error'
          });
        } else {
          this.exec();
        }
      },
      exec() {
        let that = this;
        that.log = [];
        let userId = that.userId;
        that.printLog('开始执行');
        let response;
        if (!userId) {
          that.printLog('无用户id，获取本地数据')
          response = window.localStorage.getItem('data');
          if (!response) {
            that.$message({
              message: '【错误】本地无数据，请输入白菜菊花数据id后再执行',
              type: 'error'
            })
          } else {
            that.getResult(JSON.parse(response).data, JSON.parse(response).user);
          }
        } else {
          that.printLog('用户id：' + userId + '，调接口获取个人数据')
          $.ajax({
            url: `${that.uri}/download_data?id=${userId}`,
            type: 'GET'
          }).then(rst => {
            if (!rst.result) {
              that.$message({
                message: rst.msg,
                type: 'error'
              })
            } else {
              response = JSON.stringify(rst);
              window.localStorage.setItem('data', response);
              that.getResult(JSON.parse(response).data, JSON.parse(response).user);
            }
          }).fail(err => {
            that.$message({
              message: '获取个人数据失败',
              type: 'error'
            })
          });
        }
      },
      getResult(data, user) {
        let that = this;
        that.scores = [];
        that.results = [];
        that.resultsDeatil = [];
        if (!that.checkData(data, user)) {
          return;
        }
        that.disable = true;
        that.printLog("");
        let cnt = parseInt(that.threadCnt);
        this.printLog(`同时跑${cnt}个线程`)
        that.rstShowId = -1;
        let max = 0;
        for (let i = 0; i < cnt; i++) {
          const myWorker = new Worker('./js/worker.js'); // 创建worker

          myWorker.addEventListener('message', e => { // 接收消息
            let rst = JSON.parse(e.data);
            that.scores.push(rst.score);
            that.results.push(that.fetchRstShow(rst));
            that.resultsDeatil.push(rst.logs.split('\n'));
            if (rst.score > max) {
              max = rst.score;
              that.rstShowId = that.scores.length - 1;
            }
            if (that.scores.length == cnt) {

              that.disable = false;
            }
          });

          myWorker.postMessage({
            data,
            rule: JSON.stringify(that.rule),
            passline: parseInt(that.passline),
            iterChef: parseInt(that.iterChef),
            iterRep: parseInt(that.iterRep),
            allowTool: that.allowTool
          });

        }
      },
      fetchRstShow(rst) {
        let rstShow = [];
        let repIdx = 0;
        for (let chef of rst.chefs) {
          rstShow.push(`厨师：${chef}`);
          let reps = [];
          for(let i = 0; i < 3; i++) {
            reps.push(rst.recipes[repIdx]);
            repIdx += 1;
          }
          rstShow.push(`菜谱：${reps.join('; ')}`);
          if (repIdx % 9 == 0) {
            rstShow.push('===================');
          }
        }
        rstShow.push(`分数：${rst.score}`);
        return rstShow;
      },
      checkData(data, user) {
        let userData;
        try {
          userData = JSON.parse(data);
        } catch (err) {
          this.printLog('个人数据内容无法解析，请联系小鱼（QQ:3526642175）报告有问题的数据ID');
        }
        let chefs = [];
        let reps  = [];
        for (let c in userData.chefGot) {
          if (userData.chefGot[c]) {
            chefs.push(c);
          }
        }
        for (let r in userData.repGot) {
          if (userData.repGot[r]) {
            reps.push(r);
          }
        }
        if (chefs.length > 0 && reps.length > 0) {
          this.printLog(`个人数据获取成功（昵称：${user}，厨师数：${chefs.length}，菜谱数：${reps.length}），请耐心等待结果输出`);
          return true;
        }
        this.printLog(`个人数据不正确（昵称：${user}，厨师数：${chefs.length}，菜谱数：${reps.length}），无法计算`);
        return false;
      },
      printLog(str) {
        console.log(str);
        this.log.push(str);
      },
    },
    watch: {
      passline(n) {
        this.userCfg.passline = n;
        window.localStorage.setItem('userCfg', JSON.stringify(this.userCfg));
      },
      iterChef(n) {
        this.userCfg.iterChef = n;
        window.localStorage.setItem('userCfg', JSON.stringify(this.userCfg));
      },
      iterRep(n) {
        this.userCfg.iterRep = n;
        window.localStorage.setItem('userCfg', JSON.stringify(this.userCfg));
      },
      threadCnt(n) {
        let cnt = parseInt(n);
        if (cnt < 1) {
          this.threadCnt = 1;
        } else if (cnt > 8) {
          this.threadCnt = 8;
        }
        this.userCfg.threadCnt = cnt;
        window.localStorage.setItem('userCfg', JSON.stringify(this.userCfg));
      },
      allowTool(n) {
        this.userCfg.allowTool = n;
        window.localStorage.setItem('userCfg', JSON.stringify(this.userCfg));
      },
      ruleId(id) {
        let that = this;
        that.log = [];
        that.scores = [];
        that.results = [];
        that.resultsDeatil = [];
        let rule = that.rules.find(r => r.id == id);
        rule.intents = that.intents;
        rule.buffs = that.buffs;
        that.rule = rule;
      }
    }
  });
})
