import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/** Animation clip 帧事件 `onAttackFrameHit` 的接收组件（挂在 Visual 上） */
@ccclass('AttackFrameRelay')
export class AttackFrameRelay extends Component {
    /** 由 AnimUtil 注入；每帧事件触发一次后可由外部清空 */
    handler: (() => void) | null = null;

    /** 每次 playAttackWithFrameHit 递增，用于作废旧 FINISHED/兜底回调 */
    attackToken = 0;

    onAttackFrameHit(): void {
        const fn = this.handler;
        this.handler = null;
        fn?.();
    }
}
