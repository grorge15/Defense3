import { _decorator, Camera, Component, director, math, Node, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Billboard：lateUpdate 中仅绕 Y 轴旋转 Visual 子节点朝向主相机。
 * 不修改根节点物理旋转。
 */
@ccclass('Billboard')
export class Billboard extends Component {
    @property({ tooltip: 'Visual 子节点，仅旋转此节点；不填则用自身节点' })
    visualNode: Node | null = null;

    @property({ tooltip: '主相机；不填则自动查找场景中第一个 Camera' })
    mainCamera: Camera | null = null;

    private readonly _tempDir = new Vec3();

    onLoad(): void {
        if (!this.mainCamera) {
            this.mainCamera = director.getScene()?.getComponentInChildren(Camera) ?? null;
        }
    }

    lateUpdate(): void {
        const visual = this.visualNode ?? this.node;
        const camera = this.mainCamera;
        if (!camera) {
            return;
        }

        const camPos = camera.node.worldPosition;
        const visualPos = visual.worldPosition;

        this._tempDir.set(camPos.x - visualPos.x, 0, camPos.z - visualPos.z);
        if (this._tempDir.lengthSqr() < 0.0001) {
            return;
        }
        this._tempDir.normalize();

        const angleY = math.toDegree(Math.atan2(this._tempDir.x, this._tempDir.z));
        visual.setRotationFromEuler(0, angleY, 0);
    }
}
