import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    director,
    Director,
    EventTouch,
    isValid,
    Node,
    Sprite,
    SpriteFrame,
    UIOpacity,
    UITransform,
    Vec3,
} from 'cc';
import { HeroShrine } from '../building/HeroShrine';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GameManager } from '../game/GameManager';
import { GamePhase } from '../game/GamePhase';

const { ccclass, property } = _decorator;

/**
 * 英雄二选一 UI（对齐 SFK chooseView 结构/规则，等价重写）。
 * 子节点[0]=黑遮罩；[1][2]=两卡片；卡内英雄图标槽按索引显隐；引导手指。
 * 动画参数参考：CARD_BOB=8 / CARD_BOB_HALF=0.9；遮罩 alpha≈40%(102)。
 * 禁止 import oops / chooseView。
 */
@ccclass('HeroSelectUI')
export class HeroSelectUI extends Component {
    /** 参考 chooseView CARD_BOB */
    private static readonly CARD_BOB = 8;
    /** 参考 chooseView CARD_BOB_HALF */
    private static readonly CARD_BOB_HALF = 0.9;
    private static readonly MASK_ALPHA = 102;
    private static readonly FADE_OUT_SEC = 0.25;
    private static readonly FINGER_OFFSET_X = 50;
    private static readonly FINGER_OFFSET_Y = -50;
    private static readonly FINGER_FADE_IN_SEC = 0.35;
    private static readonly FINGER_READY_SEC = 0.25;
    private static readonly FINGER_PRESS_SEC = 0.25;
    private static readonly FINGER_RELEASE_SEC = 0.3;
    private static readonly FINGER_BETWEEN_TAPS_SEC = 0.15;
    private static readonly FINGER_AFTER_TAPS_SEC = 0.28;
    private static readonly FINGER_FADE_OUT_SEC = 0.32;
    private static readonly FINGER_SWITCH_DELAY_SEC = 0.35;
    private static readonly FINGER_FADE_SCALE = 0.7;
    private static readonly FINGER_PRESS_SCALE = 0.86;
    private static readonly CARD_PULSE_SCALE = 1.06;
    private static readonly CARD_PULSE_UP_SEC = 0.08;
    private static readonly CARD_PULSE_DOWN_SEC = 0.12;

    @property({ type: SpriteFrame, tooltip: '英雄0卡牌底图（编辑器拖入）' })
    cardStyle0: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '英雄1卡牌底图（编辑器拖入）' })
    cardStyle1: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '英雄0图标（编辑器拖入）' })
    heroIcon0: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '英雄1图标（编辑器拖入）' })
    heroIcon1: SpriteFrame | null = null;

    @property({ type: Node, tooltip: '引导手指节点' })
    fingerNode: Node | null = null;

    private _mask: Node | null = null;
    private readonly _cards: Node[] = [];
    private readonly _cardSprites: (Sprite | null)[] = [];
    /** 每卡固定展示槽，slot0 显示 icon0，slot1 显示 icon1 */
    private readonly _cardHeroSlots: (Node | null)[] = [];
    private readonly _cardBasePos: Vec3[] = [];
    private readonly _cardBaseScale: Vec3[] = [];

    private _remaining: number[] = [0, 1];
    private _offer: number[] = [];
    private _shrine: HeroShrine | null = null;
    private _busy = false;
    private _canClick = false;
    private _inited = false;
    private _listening = false;
    private _destroyed = false;
    private _ownsPause = false;
    private _transition: 'closed' | 'opening' | 'idle' | 'closing' = 'closed';
    private _elapsed = 0;
    private _lastUiTime = 0;
    private _pickedSlot = -1;
    private _fingerSlot = 0;
    private _fingerElapsed = 0;
    private _fingerPhase = 'hidden';
    private readonly _fingerBaseScale = new Vec3(1, 1, 1);
    private _cardPulseSlot = -1;
    private _cardPulseElapsed = 0;
    private readonly _cardHandlers: ((e: EventTouch) => void)[] = [];
    private readonly _tmpColor = new Color();

    onLoad(): void {
        // 勿在此强制 active=false：节点可能因 ensureReady 后首次弹出才跑 onLoad
        this.ensureReady();
    }

    onDisable(): void {
        this._cleanupPanel();
    }

    onDestroy(): void {
        this._destroyed = true;
        this._cleanupPanel();
        if (this._listening) {
            EventManager.instance.offEvent(
                GameEvents.HERO_SELECT_REQUESTED,
                this._onSelectRequested,
                this,
            );
            this._listening = false;
        }
    }

    /**
     * 场景实例常开局 `_active=false`，此时 onLoad 不会执行、事件听不到。
     * UIManager / BuildSystem 在弹窗前调用，使监听挂上（无需先显示面板）。
     */
    ensureReady(): void {
        if (this._destroyed) return;
        this._ensureInit();
        if (this._listening) {
            return;
        }
        this._listening = true;
        EventManager.instance.onEvent(GameEvents.HERO_SELECT_REQUESTED, this._onSelectRequested, this);
    }

    private _ensureInit(): void {
        if (this._inited) {
            return;
        }
        this._inited = true;
        this._cacheNodes();
        this._ensureBlockInput();
        this._remaining = [0, 1];
    }

    private _cacheNodes(): void {
        const children = this.node.children;
        this._mask = children[0] ?? null;
        this._cards.length = 0;
        this._cardSprites.length = 0;
        this._cardHeroSlots.length = 0;
        this._cardBasePos.length = 0;
        this._cardBaseScale.length = 0;

        for (let i = 1; i <= 2; i++) {
            const card = children[i] ?? null;
            if (!card) {
                continue;
            }
            this._cards.push(card);
            this._cardSprites.push(card.getComponent(Sprite));
            this._cardBasePos.push(card.position.clone());
            this._cardBaseScale.push(card.scale.clone());

            this._cardHeroSlots.push(this._findHeroSlot(card, i - 1));
        }

        if (!this.fingerNode) {
            this.fingerNode = children[3] ?? null;
        }
        if (this.fingerNode && isValid(this.fingerNode)) {
            this._fingerBaseScale.set(this.fingerNode.scale);
        }
    }

    private _ensureBlockInput(): void {
        if (!this.getComponent(BlockInputEvents)) {
            this.addComponent(BlockInputEvents);
        }
        const ut = this.getComponent(UITransform);
        if (ut && (ut.contentSize.width <= 1 || ut.contentSize.height <= 1)) {
            ut.setContentSize(1280, 720);
        }
    }

    private _onSelectRequested = (...args: unknown[]): void => {
        if (this._destroyed || !this.enabled || GameManager.instance?.getPhase() === GamePhase.GameOver) {
            return;
        }
        this._ensureInit();
        const shrine = args[0] as HeroShrine | null;
        if (!shrine || this._busy) {
            return;
        }

        const remaining = this._remaining.filter((i) => i === 0 || i === 1);
        this._remaining = remaining;

        if (remaining.length === 0) {
            return;
        }

        if (remaining.length === 1) {
            const idx = remaining[0] as 0 | 1;
            this._consume(idx);
            shrine.onHeroSelected(idx);
            return;
        }

        this._busy = true;
        this._shrine = shrine;
        this._offer = remaining.slice(0, 2).sort((a, b) => a - b);
        this._openPanel();
    };

    private _openPanel(): void {
        this._ownsPause = !director.isPaused();
        if (this._ownsPause) {
            director.pause();
        }
        this.node.active = true;
        this._canClick = false;
        this._applyOfferVisuals();
        this._bindCardTouches();
        if (this.fingerNode) this.fingerNode.active = false;
        this._transition = 'opening';
        this._elapsed = 0;
        this._fingerSlot = 0;
        this._fingerElapsed = 0;
        this._fingerPhase = 'hidden';
        this._cardPulseSlot = -1;
        this._cardPulseElapsed = 0;
        this._pickedSlot = -1;
        this._lastUiTime = performance.now();
        this._getOpacity().opacity = 0;
        director.on(Director.EVENT_BEFORE_DRAW, this._onBeforeDraw, this);
        director.on(Director.EVENT_BEFORE_SCENE_LAUNCH, this._closePanel, this);
    }

    private _applyOfferVisuals(): void {
        for (let slot = 0; slot < this._cards.length; slot++) {
            const card = this._cards[slot];
            const heroIdx = this._offer[slot] ?? 0;
            const cardSprite = this._cardSprites[slot];
            if (cardSprite) {
                const style = heroIdx === 0 ? this.cardStyle0 : this.cardStyle1;
                if (style) {
                    cardSprite.spriteFrame = style;
                }
            }

            if (card) {
                for (let h = 0; h < card.children.length; h++) {
                    const child = card.children[h];
                    if (/^HeroSlot\d+$/i.test(child.name)) {
                        child.active = child === this._cardHeroSlots[slot];
                    }
                }
            }
            const iconNode = this._cardHeroSlots[slot];
            if (iconNode) {
                iconNode.active = true;
                const sp = iconNode.getComponent(Sprite);
                const frame = heroIdx === 0 ? this.heroIcon0 : this.heroIcon1;
                if (sp && frame) {
                    sp.spriteFrame = frame;
                }
            }

            if (card) {
                card.setPosition(this._cardBasePos[slot]);
                card.setScale(this._cardBaseScale[slot]);
            }
        }

        if (this._mask) {
            const sp = this._mask.getComponent(Sprite);
            if (sp) {
                this._tmpColor.set(0, 0, 0, HeroSelectUI.MASK_ALPHA);
                sp.color = this._tmpColor;
            }
        }
    }

    private _bindCardTouches(): void {
        this._unbindCardTouches();
        for (let i = 0; i < this._cards.length; i++) {
            const card = this._cards[i];
            const handler = this._makeCardHandler(i);
            this._cardHandlers.push(handler);
            card?.on(Node.EventType.TOUCH_END, handler, this);
        }
    }

    private _unbindCardTouches(): void {
        for (let i = 0; i < this._cardHandlers.length; i++) {
            const card = this._cards[i];
            if (isValid(card)) card.off(Node.EventType.TOUCH_END, this._cardHandlers[i], this);
        }
        this._cardHandlers.length = 0;
    }

    private _findHeroSlot(card: Node, slot: number): Node | null {
        return (
            card.getChildByName(`HeroSlot${slot}`) ??
            card.getChildByName('HeroSlot0') ??
            card.children[0] ??
            null
        );
    }

    private _makeCardHandler(slot: number): (e: EventTouch) => void {
        return () => {
            if (!this._canClick || this._busy === false) {
                return;
            }
            this._onCardPicked(slot);
        };
    }

    private _onCardPicked(slot: number): void {
        if (!this._busy || !this._canClick || GameManager.instance?.getPhase() === GamePhase.GameOver) {
            return;
        }
        const heroIdx = this._offer[slot];
        if (heroIdx !== 0 && heroIdx !== 1) {
            return;
        }
        this._canClick = false;
        this._stopCardBob();
        this._consume(heroIdx);
        this._pickedSlot = slot;
        this._elapsed = 0;
        this._lastUiTime = performance.now();
        this._transition = 'closing';
        if (this.fingerNode) this.fingerNode.active = false;
        // 先生成再关 UI，避免 fade/inactive 导致回调丢 shrine 或用户以为没生成
        const shrine = this._shrine;
        this._shrine = null;
        shrine?.onHeroSelected(heroIdx);
    }

    private _consume(idx: number): void {
        this._remaining = this._remaining.filter((i) => i !== idx);
    }

    private _getOpacity(): UIOpacity {
        return this._getNodeOpacity(this.node);
    }

    private _getNodeOpacity(node: Node): UIOpacity {
        let opacity = node.getComponent(UIOpacity);
        if (!opacity) {
            opacity = node.addComponent(UIOpacity);
        }
        return opacity;
    }

    // BEFORE_DRAW still runs while director simulation and its TweenSystem are paused.
    private _onBeforeDraw(): void {
        if (!this._busy) return;
        if (GameManager.instance?.getPhase() === GamePhase.GameOver) {
            this._closePanel();
            return;
        }
        const now = performance.now();
        const deltaSeconds = Math.max(0, now - this._lastUiTime) / 1000;
        this._elapsed += deltaSeconds;
        this._lastUiTime = now;
        if (this._transition === 'opening') {
            this._getOpacity().opacity = 255 * Math.min(1, this._elapsed / 0.2);
            if (this._elapsed >= 0.2) {
                this._transition = 'idle';
                this._elapsed = 0;
                this._fingerSlot = 0;
                this._fingerElapsed = 0;
                this._canClick = true;
                this._startFingerGuide();
            }
        } else if (this._transition === 'idle') {
            const cycle = (this._elapsed / HeroSelectUI.CARD_BOB_HALF) % 2;
            const offset = HeroSelectUI.CARD_BOB * (cycle <= 1 ? cycle : 2 - cycle);
            for (let i = 0; i < this._cards.length; i++) {
                const base = this._cardBasePos[i];
                this._cards[i].setPosition(base.x, base.y + offset, base.z);
            }
            this._updateFinger(deltaSeconds);
        } else if (this._transition === 'closing') {
            const card = this._cards[this._pickedSlot];
            const base = this._cardBaseScale[this._pickedSlot];
            if (card && base) {
                const scale = 1 + 0.12 * Math.min(1, this._elapsed / 0.12);
                card.setScale(base.x * scale, base.y * scale, base.z);
            }
            this._getOpacity().opacity = 255 * Math.max(0, 1 - this._elapsed / HeroSelectUI.FADE_OUT_SEC);
            if (this._elapsed >= HeroSelectUI.FADE_OUT_SEC) this._closePanel();
        }
    }

    private _closePanel(): void {
        this.node.active = false;
        this._cleanupPanel();
    }

    private _cleanupPanel(): void {
        director.off(Director.EVENT_BEFORE_DRAW, this._onBeforeDraw, this);
        director.off(Director.EVENT_BEFORE_SCENE_LAUNCH, this._closePanel, this);
        this._unbindCardTouches();
        this._busy = false;
        this._canClick = false;
        this._transition = 'closed';
        this._elapsed = 0;
        this._fingerSlot = 0;
        this._fingerElapsed = 0;
        this._fingerPhase = 'hidden';
        this._cardPulseSlot = -1;
        this._cardPulseElapsed = 0;
        this._pickedSlot = -1;
        this._shrine = null;
        this._offer = [];
        this._stopCardBob();
        for (let i = 0; i < this._cards.length; i++) {
            if (isValid(this._cards[i])) this._cards[i].setScale(this._cardBaseScale[i]);
        }
        if (isValid(this.fingerNode)) this.fingerNode.active = false;
        const ownsPause = this._ownsPause;
        this._ownsPause = false;
        if (ownsPause && director.isPaused() && GameManager.instance?.getPhase() !== GamePhase.GameOver) {
            director.resume();
        }
    }

    private _stopCardBob(): void {
        for (let i = 0; i < this._cards.length; i++) {
            const card = this._cards[i];
            if (!isValid(card)) {
                continue;
            }
            card.setPosition(this._cardBasePos[i]);
        }
    }

    private _startFingerGuide(): void {
        if (!this.fingerNode || this._cards.length === 0) {
            return;
        }
        this._fingerSlot = 0;
        this._fingerElapsed = 0;
        this._fingerPhase = 'fadeIn';
        this.fingerNode.active = true;
        this._getNodeOpacity(this.fingerNode).opacity = 0;
        this._setFingerAtRest(this._fingerSlot, HeroSelectUI.FINGER_FADE_SCALE);
    }

    private _updateFinger(deltaSeconds: number): void {
        if (!this.fingerNode || this._cards.length === 0) {
            return;
        }

        this._updateCardPulse(deltaSeconds);
        if (this._fingerPhase === 'hidden') {
            return;
        }

        this._fingerElapsed += deltaSeconds;
        const phaseDuration = this._getFingerPhaseDuration();
        if (this._fingerElapsed >= phaseDuration) {
            this._fingerElapsed = 0;
            this._advanceFingerPhase();
        }
        this._applyFingerPhase(this._fingerElapsed / this._getFingerPhaseDuration());
    }

    private _getFingerPhaseDuration(): number {
        switch (this._fingerPhase) {
        case 'fadeIn': return HeroSelectUI.FINGER_FADE_IN_SEC;
        case 'ready': return HeroSelectUI.FINGER_READY_SEC;
        case 'press1':
        case 'press2': return HeroSelectUI.FINGER_PRESS_SEC;
        case 'release1':
        case 'release2': return HeroSelectUI.FINGER_RELEASE_SEC;
        case 'betweenTaps': return HeroSelectUI.FINGER_BETWEEN_TAPS_SEC;
        case 'afterTaps': return HeroSelectUI.FINGER_AFTER_TAPS_SEC;
        case 'fadeOut': return HeroSelectUI.FINGER_FADE_OUT_SEC;
        case 'switchDelay': return HeroSelectUI.FINGER_SWITCH_DELAY_SEC;
        default: return 1;
        }
    }

    private _advanceFingerPhase(): void {
        switch (this._fingerPhase) {
        case 'fadeIn': this._fingerPhase = 'ready'; break;
        case 'ready': this._fingerPhase = 'press1'; break;
        case 'press1':
            this._startCardPulse(this._fingerSlot);
            this._fingerPhase = 'release1';
            break;
        case 'release1': this._fingerPhase = 'betweenTaps'; break;
        case 'betweenTaps': this._fingerPhase = 'press2'; break;
        case 'press2':
            this._startCardPulse(this._fingerSlot);
            this._fingerPhase = 'release2';
            break;
        case 'release2': this._fingerPhase = 'afterTaps'; break;
        case 'afterTaps': this._fingerPhase = 'fadeOut'; break;
        case 'fadeOut':
            if (this.fingerNode) this.fingerNode.active = false;
            this._fingerPhase = 'switchDelay';
            break;
        case 'switchDelay':
            this._fingerSlot = (this._fingerSlot + 1) % Math.min(this._cards.length, 2);
            this._fingerPhase = 'fadeIn';
            if (this.fingerNode) {
                this.fingerNode.active = true;
                this._getNodeOpacity(this.fingerNode).opacity = 0;
                this._setFingerAtRest(this._fingerSlot, HeroSelectUI.FINGER_FADE_SCALE);
            }
            break;
        }
    }

    private _applyFingerPhase(progress: number): void {
        const finger = this.fingerNode;
        if (!finger) {
            return;
        }
        const opacity = this._getNodeOpacity(finger);
        if (this._fingerPhase === 'fadeIn') {
            const eased = 1 - Math.cos(progress * Math.PI * 0.5);
            opacity.opacity = 255 * eased;
            this._setFingerAtRest(
                this._fingerSlot,
                HeroSelectUI.FINGER_FADE_SCALE + (1 - HeroSelectUI.FINGER_FADE_SCALE) * eased,
            );
            return;
        }
        if (this._fingerPhase === 'fadeOut') {
            const eased = Math.sin(progress * Math.PI * 0.5);
            opacity.opacity = 255 * (1 - eased);
            this._setFingerAtRest(
                this._fingerSlot,
                1 - (1 - HeroSelectUI.FINGER_FADE_SCALE) * eased,
            );
            return;
        }

        opacity.opacity = 255;
        if (this._fingerPhase === 'press1' || this._fingerPhase === 'press2') {
            const eased = 1 - Math.cos(progress * Math.PI * 0.5);
            this._setFingerAtRest(
                this._fingerSlot,
                1 - (1 - HeroSelectUI.FINGER_PRESS_SCALE) * eased,
                2 * eased,
                -16 * eased,
            );
            return;
        }
        if (this._fingerPhase === 'release1' || this._fingerPhase === 'release2') {
            const eased = 1 - Math.pow(1 - progress, 3);
            this._setFingerAtRest(
                this._fingerSlot,
                HeroSelectUI.FINGER_PRESS_SCALE + (1 - HeroSelectUI.FINGER_PRESS_SCALE) * eased,
                2 * (1 - eased),
                -16 * (1 - eased),
            );
            return;
        }
        this._setFingerAtRest(this._fingerSlot);
    }

    private _startCardPulse(slot: number): void {
        this._cardPulseSlot = slot;
        this._cardPulseElapsed = 0;
    }

    private _updateCardPulse(deltaSeconds: number): void {
        if (this._cardPulseSlot < 0) {
            return;
        }
        const card = this._cards[this._cardPulseSlot];
        const base = this._cardBaseScale[this._cardPulseSlot];
        if (!card || !base || !isValid(card)) {
            this._cardPulseSlot = -1;
            return;
        }
        this._cardPulseElapsed += deltaSeconds;
        const total = HeroSelectUI.CARD_PULSE_UP_SEC + HeroSelectUI.CARD_PULSE_DOWN_SEC;
        if (this._cardPulseElapsed >= total) {
            card.setScale(base);
            this._cardPulseSlot = -1;
            return;
        }
        const rising = this._cardPulseElapsed <= HeroSelectUI.CARD_PULSE_UP_SEC;
        const duration = rising ? HeroSelectUI.CARD_PULSE_UP_SEC : HeroSelectUI.CARD_PULSE_DOWN_SEC;
        const phase = rising
            ? this._cardPulseElapsed / duration
            : (this._cardPulseElapsed - HeroSelectUI.CARD_PULSE_UP_SEC) / duration;
        const eased = rising
            ? Math.sin(phase * Math.PI * 0.5)
            : 0.5 - 0.5 * Math.cos(phase * Math.PI);
        const scale = rising
            ? 1 + (HeroSelectUI.CARD_PULSE_SCALE - 1) * eased
            : HeroSelectUI.CARD_PULSE_SCALE - (HeroSelectUI.CARD_PULSE_SCALE - 1) * eased;
        card.setScale(base.x * scale, base.y * scale, base.z);
    }

    private _setFingerAtRest(slot: number, scale = 1, offsetX = 0, offsetY = 0): void {
        if (!this.fingerNode || !this._cards[slot]) {
            return;
        }
        const cardPos = this._cards[slot].position;
        this.fingerNode.setPosition(
            cardPos.x + HeroSelectUI.FINGER_OFFSET_X + offsetX,
            cardPos.y + HeroSelectUI.FINGER_OFFSET_Y + offsetY,
            cardPos.z,
        );
        this.fingerNode.setScale(
            this._fingerBaseScale.x * scale,
            this._fingerBaseScale.y * scale,
            this._fingerBaseScale.z,
        );
    }
}
