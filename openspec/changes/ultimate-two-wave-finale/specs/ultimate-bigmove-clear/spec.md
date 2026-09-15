## MODIFIED Requirements

### Requirement: Ultimate finale synchronizes lock, completed camera pullback, VFX, clear, and victory

The system SHALL 执行两轮集体大招：锁移动并播放第一轮，在第一轮全部完成后播放第二轮并同时拉远镜头，在第二轮和镜头均完成后进入既有最终死亡呈现、整批清理与胜利结算。每轮 SHALL 在全部有效且去重的既有点位同步播放一次。第一轮 SHALL 在起播边界对当时所有存活且活动的小怪及 Boss 统一造成当前血量 50% 的伤害，沿用普通命中的受击反馈与血量显示；该伤害 MUST NOT 按播放点位数叠加或因为整数取整直接杀死低血敌人。50% 当前血量是此草案的暂定审阅口径。

#### Scenario: First collective wave damages without final cleanup

- **WHEN** 结尾触发且存在有效播放点位与存活敌人
- **THEN** 玩家移动锁定，第一轮同时起播，镜头保持当前跟随构图；100、30、1 血的目标分别变为 50、15、0.5 血并出现原受击反馈，且不启动最终死亡或胜利流程

#### Scenario: Second collective wave accompanies camera pullback

- **WHEN** 第一轮所有表现完成
- **THEN** 第二轮全体表现与镜头拉远同时启动，并等待两者都完成才进入既有最终死亡呈现；任何一方先完成都不能提前清场或弹出胜利

#### Scenario: Final cleanup preserves death presentation and settlement

- **WHEN** 第二轮与镜头都完成
- **THEN** 停止后续刷怪，全部清理目标完成或安全跳过最终死亡呈现后统一移除，再进行一次既有胜利结算，且不触发普通击杀奖励或复活副作用

#### Scenario: Repeated signals cannot repeat damage or waves

- **WHEN** 收尾期间发生重复触发、完成事件、超时回调或晚到资源回调
- **THEN** 第一轮伤害仍只结算一次，每个点位最多播放两轮，最终清理与胜利各执行一次

#### Scenario: Missing presentation data or camera cannot strand the finale

- **WHEN** 点位无效、动画或资源不可用、资源加载失败或超时，或镜头缺失或运行中失效
- **THEN** 只跳过不可用的表现，第一轮伤害逻辑仍仅执行一次，其他可用表现继续按双轮顺序运行，所有必需分支安全完成后进入既有最终死亡与胜利流程

#### Scenario: Disposed finale ignores asynchronous results

- **WHEN** 收尾宿主已销毁或禁用后仍收到异步结果
- **THEN** 结果不会创建新特效、继续扣血或触发胜利，已创建的临时表现得到清理
