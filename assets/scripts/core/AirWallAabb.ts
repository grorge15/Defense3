import { BoxCollider2D, Rect, Scene, Vec2, Vec3 } from 'cc';

const _wallRect = new Rect();
const _selfRect = new Rect();
const _probePos = new Vec3();
/** 绕障试探角（度）：先正后负，由小到大 */
const STEER_ANGLES_DEG = [0, 30, -30, 60, -60, 90, -90, 120, -120];

/**
 * 高台 airWall* AABB 阻挡（位移驱动 + sensor 时物理不会挡）。
 * 调用方缓存 walls 列表；本模块只做收集、最小穿透推出与轻量绕障转向。
 */
export class AirWallAabb {
    /** 收集场景中节点名 startsWith('airWall') 的 BoxCollider2D；cache 可复用并失效时重建 */
    static collectAirWalls(scene: Scene | null, cache: BoxCollider2D[] = []): BoxCollider2D[] {
        let valid = cache.length > 0;
        if (valid) {
            for (const box of cache) {
                if (!box?.isValid) {
                    valid = false;
                    break;
                }
            }
        }
        if (valid) {
            return cache;
        }

        cache.length = 0;
        if (!scene) {
            return cache;
        }
        for (const box of scene.getComponentsInChildren(BoxCollider2D)) {
            if (box.node?.name?.startsWith('airWall')) {
                cache.push(box);
            }
        }
        return cache;
    }

    /**
     * 以 worldPos 为中心、width×height 为自身 AABB，对 airWall 做最小穿透轴推出。
     * 若传入 velocity，推出轴上会钳制速度（避免持续顶入）。
     */
    static resolveWorldPos(
        worldPos: Vec3,
        width: number,
        height: number,
        walls: BoxCollider2D[],
        velocity?: Vec2 | null,
    ): void {
        if (walls.length === 0 || width <= 0 || height <= 0) {
            return;
        }

        const fillSelf = (): void => {
            _selfRect.set(worldPos.x - width * 0.5, worldPos.y - height * 0.5, width, height);
        };
        fillSelf();

        for (const box of walls) {
            if (!box?.isValid || !box.node?.activeInHierarchy) {
                continue;
            }
            const a = box.worldAABB;
            _wallRect.set(a.x, a.y, Math.abs(a.width), Math.abs(a.height));
            if (
                _selfRect.xMax < _wallRect.xMin ||
                _selfRect.xMin > _wallRect.xMax ||
                _selfRect.yMax < _wallRect.yMin ||
                _selfRect.yMin > _wallRect.yMax
            ) {
                continue;
            }

            const penL = _selfRect.xMax - _wallRect.xMin;
            const penR = _wallRect.xMax - _selfRect.xMin;
            const penB = _selfRect.yMax - _wallRect.yMin;
            const penT = _wallRect.yMax - _selfRect.yMin;
            if (penL <= 0 || penR <= 0 || penB <= 0 || penT <= 0) {
                continue;
            }

            const minPen = Math.min(penL, penR, penB, penT);
            if (minPen === penL) {
                worldPos.x -= penL;
                if (velocity) {
                    velocity.x = Math.min(velocity.x, 0);
                }
            } else if (minPen === penR) {
                worldPos.x += penR;
                if (velocity) {
                    velocity.x = Math.max(velocity.x, 0);
                }
            } else if (minPen === penB) {
                worldPos.y -= penB;
                if (velocity) {
                    velocity.y = Math.min(velocity.y, 0);
                }
            } else {
                worldPos.y += penT;
                if (velocity) {
                    velocity.y = Math.max(velocity.y, 0);
                }
            }
            fillSelf();
        }
    }

    /** 从节点 BoxCollider2D 取包围尺寸；无则回退 defaultW/H */
    static bodySize(node: { getComponent: (t: typeof BoxCollider2D) => BoxCollider2D | null }, defaultW = 40, defaultH = 40): { w: number; h: number } {
        const box = node.getComponent(BoxCollider2D);
        if (box) {
            const w = Math.abs(box.size.width);
            const h = Math.abs(box.size.height);
            if (w >= 1 && h >= 1) {
                return { w, h };
            }
        }
        return { w: defaultW, h: defaultH };
    }

    /** 以 worldPos 为中心的 AABB 是否与任一有效 airWall 重叠 */
    static overlapsAny(worldPos: Vec3, width: number, height: number, walls: BoxCollider2D[]): boolean {
        if (walls.length === 0 || width <= 0 || height <= 0) {
            return false;
        }
        _selfRect.set(worldPos.x - width * 0.5, worldPos.y - height * 0.5, width, height);
        for (const box of walls) {
            if (!box?.isValid || !box.node?.activeInHierarchy) {
                continue;
            }
            const a = box.worldAABB;
            _wallRect.set(a.x, a.y, Math.abs(a.width), Math.abs(a.height));
            if (
                _selfRect.xMax > _wallRect.xMin &&
                _selfRect.xMin < _wallRect.xMax &&
                _selfRect.yMax > _wallRect.yMin &&
                _selfRect.yMin < _wallRect.yMax
            ) {
                return true;
            }
        }
        return false;
    }

    /**
     * 轻量绕障：沿朝向目标方向探测；若会撞墙则试 ±30/60/90/120°，
     * 优先选仍朝向目标（dot>0）的畅通方向，写入 outDir（单位向量）。
     */
    static steerDirection(
        from: Vec3,
        target: Vec3,
        width: number,
        height: number,
        walls: BoxCollider2D[],
        outDir: Vec2,
        probeDist?: number,
    ): void {
        const dx = target.x - from.x;
        const dy = target.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) {
            outDir.set(0, 0);
            return;
        }
        const desiredX = dx / dist;
        const desiredY = dy / dist;
        outDir.set(desiredX, desiredY);

        if (walls.length === 0) {
            return;
        }

        const step = probeDist ?? Math.max(width, height, 24) * 0.65;
        let bestDot = Number.NEGATIVE_INFINITY;
        let found = false;
        let bestX = desiredX;
        let bestY = desiredY;

        for (const deg of STEER_ANGLES_DEG) {
            const rad = (deg * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const dirX = desiredX * cos - desiredY * sin;
            const dirY = desiredX * sin + desiredY * cos;
            _probePos.set(from.x + dirX * step, from.y + dirY * step, from.z);
            if (AirWallAabb.overlapsAny(_probePos, width, height, walls)) {
                continue;
            }
            const dot = dirX * desiredX + dirY * desiredY;
            if (!found) {
                found = true;
                bestDot = dot;
                bestX = dirX;
                bestY = dirY;
                if (deg === 0) {
                    break;
                }
                continue;
            }
            // 已有候选：优先更大的朝向进度；同进度取更小偏角（数组已按 |角| 排序，先到先得）
            if (dot > bestDot + 1e-4) {
                bestDot = dot;
                bestX = dirX;
                bestY = dirY;
            }
        }

        if (found) {
            outDir.set(bestX, bestY);
        }
    }
}
