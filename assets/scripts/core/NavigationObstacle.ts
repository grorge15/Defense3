import { _decorator, Component, Enum } from 'cc';

const { ccclass, property } = _decorator;

export enum NavigationObstacleKind {
    Ignore = 0,
    Hard = 1,
    Destructible = 2,
}

/** Explicit navigation classification. It intentionally overrides legacy component inference. */
@ccclass('NavigationObstacle')
export class NavigationObstacle extends Component {
    @property({ type: Enum(NavigationObstacleKind) })
    kind: NavigationObstacleKind = NavigationObstacleKind.Hard;
}
