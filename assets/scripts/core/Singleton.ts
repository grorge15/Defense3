/**
 * 非 Component 单例基类。
 * 用法：class FooManager extends Singleton<FooManager> { ... }
 *       const foo = FooManager.getInstance();
 */
export class Singleton<T> {
    private static _instances = new Map<new () => unknown, unknown>();

    public static getInstance<T>(this: new () => T): T {
        if (!Singleton._instances.has(this)) {
            Singleton._instances.set(this, new this());
        }
        return Singleton._instances.get(this) as T;
    }

    protected constructor() {}
}
