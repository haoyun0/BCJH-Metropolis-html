$(function() {
  var app = new Vue({
    el: '#main',
    data: {
      uri: 'https://bcjh.xyz/api',
      result: [],
      form: {},
      userId: null,
      rules: [],
      disable: false,
      ruleId: null,
      passline: null,
      iterChef: 5000,
      iterRep: 1000,
      userCfg: {},
      rule: {}
    },
    mounted() {
      let that = this;
      that.getUserCfg();
      that.getRule();
    },
    methods: {
      getUserCfg() {
        let userCfg = window.localStorage.getItem('userCfg');
        if (userCfg) {
          this.userCfg = JSON.parse(userCfg);
          this.passline = this.userCfg.passline || this.passline;
          this.iterChef = this.userCfg.iterChef || this.iterChef;
          this.iterRep = this.userCfg.iterRep || this.iterRep;
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
        that.result = [];
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
            that.printLog('个人数据获取成功，请耐心等待结果输出');
            that.getResult(JSON.parse(response).data);
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
              that.printLog('个人数据获取成功，请耐心等待');
            }
            that.getResult(JSON.parse(response).data);
          }).fail(err => {
            that.$message({
              message: '获取个人数据失败',
              type: 'error'
            })
          });
        }
      },
      getResult(data) {
        let that = this;
        that.disable = true;
        that.printLog("");
        const cnt = 8;
        let scores = [];
        let max = 0;
        let result;
        for (let i = 0; i < cnt; i++) {
          const myWorker = new Worker('./js/worker.js'); // 创建worker

          myWorker.addEventListener('message', e => { // 接收消息
            let rst = JSON.parse(e.data);
            scores.push(rst.score);
            if (rst.score > max) {
              max = rst.score;
              result = rst;
            }
            if (scores.length == 1) {
              that.printLog(`分数列表：${scores.join(', ')}`);
            } else {
              that.printLast(`分数列表：${scores.join(', ')}`);
            }
            if (scores.length == cnt) {
              // 全执行完了
              that.printLog('最佳结果：');
              let repIdx = 0;
              for (let chef of result.chefs) {
                that.printLog(`厨师：${chef}`);
                let reps = [];
                for(let i = 0; i < 3; i++) {
                  reps.push(result.recipes[repIdx]);
                  repIdx += 1;
                }
                that.printLog(`菜谱：${reps.join('; ')}`);
                if (repIdx % 9 == 0) {
                  that.printLog('===================');
                }
              }
              that.printLog(`分数：${result.score}`);
              that.disable = false;
            }
          });

          myWorker.postMessage({
            data,
            rule: JSON.stringify(that.rule),
            passline: parseInt(that.passline),
            iterChef: parseInt(that.iterChef),
            iterRep: parseInt(that.iterRep)
          });

        }
      },
      printLog(str) {
        console.log(str);
        this.result.push(str);
      },
      printLast(str) {
        console.log(str);
        this.result.pop();
        this.result.push(str);
      }
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
      ruleId(id) {
        let that = this;
        that.result = [];
        let rule = that.rules.find(r => r.id == id);
        rule.intents = that.intents;
        rule.buffs = that.buffs;
        that.rule = rule;
      }
    }
  });
})
