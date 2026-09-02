import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    EventTouch,
    Node,
    Sprite,
    SpriteFrame,
    UIOpacity,
    UITransform,
    Vec3,
    tween,
} from 'cc';
import { HeroShrine } from '../building/HeroShrine';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';

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
    /** 每卡下英雄图标槽 [card][heroIndex] */
    private readonly _cardHeroSlots: (Node | null)[][] = [];
    private readonly _cardBasePos: Vec3[] = [];
    private readonly _cardBaseScale: Vec3[] = [];

    private _remaining: number[] = [0, 1];
    private _offer: number[] = [];
    private _shrine: HeroShrine | null = null;
    private _busy = false;
    private _canClick = false;
    private _inited = false;
    private readonly _tmpColor = new Color();

    onLoad(): void {
        this._ensureInit();
        this.node.active = false;
        EventManager.instance.onEvent(GameEvents.HERO_SELECT_REQUESTED, this._onSelectRequested, this);
    }

    onDestroy(): void {
        this._unbindCardTouches();
        EventManager.instance.offEvent(GameEvents.HERO_SELECT_REQUESTED, this._onSelectRequested, this);
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

            const slots: (Node | null)[] = [];
            for (let h = 0; h < 4; h++) {
                slots.push(card.children[h] ?? null);
            }
            this._cardHeroSlots.push(slots);
        }

        if (!this.fingerNode) {
            this.fingerNode = children[3] ?? null;
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
        this._offer = this._pickTwo(remaining);
        this._openPanel();
    };

    private _pickTwo(pool: number[]): number[] {
        const copy = pool.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy.slice(0, 2);
    }

    private _openPanel(): void {
        this.node.active = true;
        this._canClick = false;
        this._applyOfferVisuals();
        this._bindCardTouches();
        this._fadeIn(() => {
            this._canClick = true;
            this._startCardBob();
            this._placeFinger(0);
        });
    }

    private _applyOfferVisuals(): void {
        for (let slot = 0; slot < this._cards.length; slot++) {
            const heroIdx = this._offer[slot] ?? 0;
            const cardSprite = this._cardSprites[slot];
            if (cardSprite) {
                const style = heroIdx === 0 ? this.cardStyle0 : this.cardStyle1;
                if (style) {
                    cardSprite.spriteFrame = style;
                }
            }

            const slots = this._cardHeroSlots[slot] ?? [];
            for (let h = 0; h < slots.length; h++) {
                const iconNode = slots[h];
                if (!iconNode) {
                    continue;
                }
                const show = h === heroIdx;
                iconNode.active = show;
                if (show) {
                    const sp = iconNode.getComponent(Sprite);
                    const frame = heroIdx === 0 ? this.heroIcon0 : this.heroIcon1;
                    if (sp && frame) {
                        sp.spriteFrame = frame;
                    }
                }
            }

            const card = this._cards[slot];
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
            card?.on(Node.EventType.TOUCH_END, this._makeCardHandler(i), this);
        }
    }

    private _unbindCardTouches(): void {
        for (const card of this._cards) {
            card?.off(Node.EventType.TOUCH_END);
        }
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
        const heroIdx = this._offer[slot];
        if (heroIdx !== 0 && heroIdx !== 1) {
            return;
        }
        this._canClick = false;
        this._stopCardBob();
        this._consume(heroIdx);
        const card = this._cards[slot];
        if (card) {
            const baseScale = this._cardBaseScale[slot] ?? card.scale.clone();
            tween(card)
                .to(0.12, {
                    scale: new Vec3(baseScale.x * 1.12, baseScale.y * 1.12, baseScale.z),
                })
                .start();
        }
        const shrine = this._shrine;
        this._fadeOut(() => {
            this.node.active = false;
            this._busy = false;
            this._shrine = null;
            this._unbindCardTouches();
            shrine?.onHeroSelected(heroIdx);
        });
    }

    private _consume(idx: number): void {
        this._remaining = this._remaining.filter((i) => i !== idx);
    }

    private _fadeIn(done: () => void): void {
        let opacity = this.getComponent(UIOpacity);
        if (!opacity) {
            opacity = this.addComponent(UIOpacity);
        }
        opacity.opacity = 0;
        tween(opacity)
            .to(0.2, { opacity: 255 })
            .call(done)
            .start();
    }

    private _fadeOut(done: () => void): void {
        let opacity = this.getComponent(UIOpacity);
        if (!opacity) {
            opacity = this.addComponent(UIOpacity);
        }
        tween(opacity)
            .to(HeroSelectUI.FADE_OUT_SEC, { opacity: 0 })
            .call(done)
            .start();
    }

    private _startCardBob(): void {
        for (let i = 0; i < this._cards.length; i++) {
            const card = this._cards[i];
            if (!card) {
                continue;
            }
            const base = this._cardBasePos[i];
            const amp = HeroSelectUI.CARD_BOB;
            const half = HeroSelectUI.CARD_BOB_HALF;
            tween(card)
                .repeatForever(
                    tween()
                        .to(half, { position: new Vec3(base.x, base.y + amp, base.z) })
                        .to(half, { position: new Vec3(base.x, base.y, base.z) }),
                )
                .start();
        }
    }

    private _stopCardBob(): void {
        for (let i = 0; i < this._cards.length; i++) {
            const card = this._cards[i];
            if (!card) {
                continue;
            }
            tween(card).stop();
            card.setPosition(this._cardBasePos[i]);
        }
    }

    private _placeFinger(slot: number): void {
        if (!this.fingerNode || !this._cards[slot]) {
            return;
        }
        this.fingerNode.active = true;
        const cardPos = this._cards[slot].position;
        this.fingerNode.setPosition(cardPos.x + 12, cardPos.y + 34, cardPos.z);
    }
}
