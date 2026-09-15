import {
    _decorator,
    AudioClip,
    AudioSource,
    Component,
    Game,
    game,
    Input,
    input,
} from 'cc';
import { GamePhase } from '../game/GamePhase';
import { EventManager } from './EventManager';
import { GameConfig } from './GameConfig';
import { GameEvents } from './GameEvents';

const { ccclass, property } = _decorator;

export type AudioCue =
    | 'playerAttack'
    | 'towerVolley'
    | 'hero1Attack'
    | 'hero2Attack'
    | 'enemyDeath'
    | 'coinCollect'
    | 'buildComplete'
    | 'heroSpawn';

@ccclass('AudioCueConfig')
export class AudioCueConfig {
    @property({ type: AudioClip, tooltip: '留空时该 cue 静音' })
    clip: AudioClip | null = null;

    @property({ tooltip: '关闭时该 cue 静音' })
    enabled = true;

    @property({ tooltip: '相对全局通道音量的倍率' })
    volumeMultiplier = GameConfig.audioCueVolumeMultiplier;

    @property({ tooltip: '同一 cue 两次播放之间的最小秒数' })
    minInterval = GameConfig.audioBgmMinInterval;
}

function makeCue(minInterval: number): AudioCueConfig {
    const cue = new AudioCueConfig();
    cue.minInterval = minInterval;
    return cue;
}

/** 场景级音频入口；未挂载时静态请求安全静音。 */
@ccclass('AudioManager')
export class AudioManager extends Component {
    private static _instance: AudioManager | null = null;
    private static _warnedMissingManager = false;

    @property({ type: AudioCueConfig, tooltip: '背景音乐：首次输入后循环播放' })
    bgmCue = makeCue(GameConfig.audioBgmMinInterval);

    @property({ type: AudioCueConfig, tooltip: '玩家成功发出箭矢' })
    playerAttackCue = makeCue(GameConfig.audioAttackMinInterval);

    @property({ type: AudioCueConfig, tooltip: '箭塔单次齐射' })
    towerVolleyCue = makeCue(GameConfig.audioAttackMinInterval);

    @property({ type: AudioCueConfig, tooltip: 'Hero 1 成功发出弹道；默认 clip 为空' })
    hero1AttackCue = makeCue(GameConfig.audioAttackMinInterval);

    @property({ type: AudioCueConfig, tooltip: 'Hero 2 成功发出弹道' })
    hero2AttackCue = makeCue(GameConfig.audioAttackMinInterval);

    @property({ type: AudioCueConfig, tooltip: '普通小怪或 Boss 死亡；终结清场不调用' })
    enemyDeathCue = makeCue(GameConfig.audioDeathMinInterval);

    @property({ type: AudioCueConfig, tooltip: '金币实际收集到账' })
    coinCollectCue = makeCue(GameConfig.audioCoinMinInterval);

    @property({ type: AudioCueConfig, tooltip: '单次建造完成' })
    buildCompleteCue = makeCue(GameConfig.audioBuildMinInterval);

    @property({ type: AudioCueConfig, tooltip: '英雄实例激活后' })
    heroSpawnCue = makeCue(GameConfig.audioHeroSpawnMinInterval);

    @property({ tooltip: 'BGM 总音量' })
    bgmVolume = GameConfig.audioBgmVolume;

    @property({ tooltip: '短音效总音量' })
    sfxVolume = GameConfig.audioSfxVolume;

    @property({ tooltip: '全局静音；开启时不启动或播放新音频' })
    muteAll = false;

    @property({ tooltip: '同时播放的短音效上限；满时跳过新请求' })
    sfxConcurrencyLimit = GameConfig.audioSfxConcurrencyLimit;

    private _bgmSource: AudioSource | null = null;
    private _hasUserInteracted = false;
    private _hidden = false;
    private _gameOver = false;
    private _resumeBgmAfterShow = false;
    private readonly _lastPlayedAt = new Map<AudioCue, number>();
    private readonly _sfxSources: AudioSource[] = [];
    private readonly _activeSfx = new Set<AudioSource>();
    private readonly _sfxGenerations = new Map<AudioSource, number>();

    public static get instance(): AudioManager | null {
        return AudioManager._instance;
    }

    /** 业务脚本统一从此入口请求 cue；未挂载时仅一次提示并保持静音。 */
    public static playSfx(cue: AudioCue): void {
        const manager = AudioManager._instance;
        if (!manager) {
            if (!AudioManager._warnedMissingManager) {
                AudioManager._warnedMissingManager = true;
                console.warn('[AudioManager] no active AudioManager; audio cues are muted');
            }
            return;
        }
        manager.playSfx(cue);
    }

    onLoad(): void {
        if (AudioManager._instance && AudioManager._instance !== this) {
            console.warn('[AudioManager] duplicate component ignored');
            this.enabled = false;
            return;
        }
        AudioManager._instance = this;
        AudioManager._warnedMissingManager = false;

        this._bgmSource = this.node.addComponent(AudioSource);
        this._bgmSource.loop = true;

        input.on(Input.EventType.TOUCH_START, this._onFirstInput, this);
        input.on(Input.EventType.MOUSE_DOWN, this._onFirstInput, this);
        input.on(Input.EventType.KEY_DOWN, this._onFirstInput, this);
        game.on(Game.EVENT_HIDE, this._onHide, this);
        game.on(Game.EVENT_SHOW, this._onShow, this);
        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this._onFirstInput, this);
        input.off(Input.EventType.MOUSE_DOWN, this._onFirstInput, this);
        input.off(Input.EventType.KEY_DOWN, this._onFirstInput, this);
        game.off(Game.EVENT_HIDE, this._onHide, this);
        game.off(Game.EVENT_SHOW, this._onShow, this);
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        this.stopAllAudio();
        this.unscheduleAllCallbacks();
        if (AudioManager._instance === this) {
            AudioManager._instance = null;
        }
    }

    /** 供 Gameplay 成功路径调用；被跳过的 cue 不排队。 */
    public playSfx(cue: AudioCue): void {
        if (this.muteAll || this._hidden || this._gameOver) {
            return;
        }
        const config = this._configFor(cue);
        const clip = config.clip;
        if (!config.enabled || !clip) {
            return;
        }

        const now = Date.now() * 0.001;
        const minInterval = Math.max(0, Number(config.minInterval) || 0);
        const lastPlayedAt = this._lastPlayedAt.get(cue);
        if (lastPlayedAt !== undefined && now - lastPlayedAt < minInterval) {
            return;
        }

        const limit = Math.max(0, Math.floor(Number(this.sfxConcurrencyLimit) || 0));
        if (limit === 0 || this._activeSfx.size >= limit) {
            return;
        }
        const source = this._acquireSfxSource();
        if (!source) {
            return;
        }

        source.stop();
        source.clip = clip;
        source.loop = false;
        source.volume = this._clampVolume(this.sfxVolume * config.volumeMultiplier);
        source.play();
        this._lastPlayedAt.set(cue, now);
        this._activeSfx.add(source);

        const generation = (this._sfxGenerations.get(source) ?? 0) + 1;
        this._sfxGenerations.set(source, generation);
        this.scheduleOnce(() => this._finishSfx(source, generation), this._clipDuration(clip));
    }

    /** GameOver 与销毁时立即停止 BGM 和所有短音效。 */
    public stopAllAudio(): void {
        this._bgmSource?.stop();
        this._resumeBgmAfterShow = false;
        this._stopAllSfx();
    }

    private _onFirstInput = (): void => {
        this._hasUserInteracted = true;
        input.off(Input.EventType.TOUCH_START, this._onFirstInput, this);
        input.off(Input.EventType.MOUSE_DOWN, this._onFirstInput, this);
        input.off(Input.EventType.KEY_DOWN, this._onFirstInput, this);
        this._startBgmIfReady();
    };

    private _onHide = (): void => {
        this._hidden = true;
        this._resumeBgmAfterShow = !!this._bgmSource?.playing;
        if (this._bgmSource?.playing) {
            this._bgmSource.pause();
        }
        this._stopAllSfx();
    };

    private _onShow = (): void => {
        this._hidden = false;
        if (!this._gameOver && this._resumeBgmAfterShow) {
            this._startBgmIfReady();
        }
        this._resumeBgmAfterShow = false;
    };

    private _onPhaseChanged = (...args: unknown[]): void => {
        if (args[0] !== GamePhase.GameOver && args[0] !== 'game_over') {
            return;
        }
        this._gameOver = true;
        this.stopAllAudio();
    };

    private _startBgmIfReady(): void {
        const source = this._bgmSource;
        const config = this.bgmCue;
        if (
            !source ||
            !this._hasUserInteracted ||
            this._hidden ||
            this._gameOver ||
            this.muteAll ||
            !config.enabled ||
            !config.clip ||
            source.playing
        ) {
            return;
        }
        source.clip = config.clip;
        source.loop = true;
        source.volume = this._clampVolume(this.bgmVolume * config.volumeMultiplier);
        source.play();
    }

    private _configFor(cue: AudioCue): AudioCueConfig {
        switch (cue) {
            case 'playerAttack': return this.playerAttackCue;
            case 'towerVolley': return this.towerVolleyCue;
            case 'hero1Attack': return this.hero1AttackCue;
            case 'hero2Attack': return this.hero2AttackCue;
            case 'enemyDeath': return this.enemyDeathCue;
            case 'coinCollect': return this.coinCollectCue;
            case 'buildComplete': return this.buildCompleteCue;
            case 'heroSpawn': return this.heroSpawnCue;
        }
    }

    private _acquireSfxSource(): AudioSource | null {
        const available = this._sfxSources.find((source) => !this._activeSfx.has(source));
        if (available) {
            return available;
        }
        const source = this.node.addComponent(AudioSource);
        this._sfxSources.push(source);
        return source;
    }

    private _finishSfx(source: AudioSource, generation: number): void {
        if (this._sfxGenerations.get(source) !== generation) {
            return;
        }
        source.stop();
        this._activeSfx.delete(source);
    }

    private _stopAllSfx(): void {
        for (const source of this._sfxSources) {
            this._sfxGenerations.set(source, (this._sfxGenerations.get(source) ?? 0) + 1);
            source.stop();
        }
        this._activeSfx.clear();
        this.unscheduleAllCallbacks();
    }

    private _clipDuration(clip: AudioClip): number {
        const duration = clip.getDuration();
        return Number.isFinite(duration) && duration > 0 ? duration : 0.05;
    }

    private _clampVolume(value: number): number {
        return Math.max(0, Math.min(1, Number(value) || 0));
    }
}
