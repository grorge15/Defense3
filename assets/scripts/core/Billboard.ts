import { _decorator, Camera, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

/** Billboard：保留组件和序列化字段；当前不再修改节点 rotation。 */
@ccclass('Billboard')
export class Billboard extends Component {
    @property({ tooltip: 'Visual 子节点，仅旋转此节点；不填则用自身节点' })
    visualNode: Node | null = null;

    @property({ tooltip: '主相机；不填则自动查找场景中第一个 Camera' })
    mainCamera: Camera | null = null;

    lateUpdate(): void {
        // Intentionally disabled: character/trap visuals keep authored rotation.
    }
}
