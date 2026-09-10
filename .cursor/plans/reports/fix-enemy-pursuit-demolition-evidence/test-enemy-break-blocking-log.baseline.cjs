const assert = require('assert');
const fs = require('fs');
const path = require('path');
const previous = process.env.NAV_HARNESS_ONLY;
process.env.NAV_HARNESS_ONLY = '1';
const h = require('./test-enemy-navigation.cjs');
if (previous === undefined) delete process.env.NAV_HARNESS_ONLY;
else process.env.NAV_HARNESS_ONLY = previous;
const root = path.resolve(__dirname, '../..');
const evidenceDir = path.resolve(root, process.env.NAV_EVIDENCE_DIR || '.cursor/plans/reports/enemy-unified-navigation-evidence/test-enemy-break-blocking-log');
fs.mkdirSync(evidenceDir, { recursive: true });
const script = name => path.join(root, `assets/scripts/${name}.ts`);
const base = h.actualScriptMocks();
base.cc.CircleCollider2D ??= class {};
base.mocks[script('game/CoinSystem')] = { CoinSystem: class { static instance = null; } };
base.mocks[script('core/TweenUtil')] = { TweenUtil: { fadeOutOpacity(_n, _t, cb) { cb?.(); } } };
delete base.mocks[script('core/EnemyNavigation')];
delete base.mocks[script('item/Log')];
delete base.mocks[script('core/NavigationObstacle')];
const { GameConfig } = h.loadTs('assets/scripts/core/GameConfig.ts');
base.mocks[script('core/GameConfig')].GameConfig = GameConfig;
const events = [];
base.mocks[script('core/EventManager')].EventManager.instance.emitEvent = (...args) => events.push(args);
const { NavigationObstacle, NavigationObstacleKind: Kind } = h.loadTs('assets/scripts/core/NavigationObstacle.ts', base.mocks);
const { Log } = h.loadTs('assets/scripts/item/Log.ts', base.mocks);
base.mocks[script('item/Log')] = { Log };
const { EnemyNavigation } = h.loadTs('assets/scripts/core/EnemyNavigation.ts', base.mocks);
const { EnemyMinion } = h.loadTs('assets/scripts/enemy/EnemyMinion.ts', base.mocks);
const { EnemyBoss } = h.loadTs('assets/scripts/enemy/EnemyBoss.ts', base.mocks);
const results = [], frameSamples = [];
function test(name, fn) {
    try { results.push({ name, passed: true, details: fn() }); console.log(`ok - ${name}`); }
    catch (error) { results.push({ name, passed: false, error: String(error.stack ?? error) }); console.error(`not ok - ${name}\n${error.stack}`); process.exitCode = 1; }
}
function pos(node) { const p = new base.cc.Vec3(); node.getWorldPosition(p); return p; }
function mark(node, kind) { const m = node.getComponent(NavigationObstacle) ?? node.addComponent(NavigationObstacle); m.kind = kind; return m; }
function fixture(options = {}) {
    const scene = h.eventNode('unified-scene'); scene.scene = scene;
    const node = (name, x, y) => scene.add(h.eventNode(name, x, y));
    const nav = EnemyNavigation.get(scene);
    const ground = [[-300,-300],[300,-300],[300,300],[-300,300]].map(([x,y]) => node('ground',x,y));
    nav.configure({ boundsMin: ground[0], boundsMax: ground[2], walkablePolygon: ground });
    function collider(n, r) {
        const b = new base.cc.BoxCollider2D(); b.node=n; b.enabled=true; b.sensor=false;
        b.worldAABB = new base.cc.Rect(r.xMin,r.yMin,r.xMax-r.xMin,r.yMax-r.yMin);
        n.components.set(n.components.has(base.cc.BoxCollider2D) ? Symbol('extraCollider') : base.cc.BoxCollider2D,b);
        scene.emit('component-added',b); return b;
    }
    function box(name, r, Type = null, kind = null) {
        const n = node(name,(r.xMin+r.xMax)/2,(r.yMin+r.yMax)/2);
        const c=Type?n.addComponent(Type):null;
        if(kind!==null) mark(n,kind);
        const b=collider(n,r); return {n,b,c};
    }
    // Actual solid walls and a 235x19 log form the seal; no portal configuration.
    box('airWall-left',{xMin:-300,xMax:-117.5,yMin:-20,yMax:20});
    box('airWall-right',{xMin:117.5,xMax:300,yMin:-20,yMax:20});
    const log=box('blocking-log',options.logRect ?? {xMin:-117.5,xMax:117.5,yMin:-9.5,yMax:9.5},Log);
    log.c._phase='fixed'; log.c._isLocked=true; log.c._hp=GameConfig.logMaxHp; log.c._collider=log.b;
    const unit=node('unit',0,-180),target=node('player',0,180);target.addComponent(base.classes.Player);
    const body=options.body ?? {width:10,height:10};
    return {scene,node,nav,ground,box,collider,log,unit,target,body,
        request:{unit,target,role:'minion',speed:40,dt:0.1,body,stopDistance:32}};
}
function sample(f,label) {
    const flow=f.nav._field,work=f.nav.debugStats.schedulerLastWork;
    assert(work<=4096);assert(flow.debugEntries<=32);assert(flow.debugBytes<=8388608);
    frameSamples.push({label,work,pending:flow.debugPendingJobs,entries:flow.debugEntries,bytes:flow.debugBytes,
        version:f.nav._area.obstacleVersion,completed:flow.debugJobStats.completed});
}
function settled(f,query,label='query') {
    const refused=f.nav._field.debugJobStats.refused;
    for(let frame=0;frame<128;frame++) {
        const result=query();sample(f,label);
        assert.strictEqual(f.nav._field.debugJobStats.refused,refused,'admission failure is not settled unreachable');
        if(!f.nav._field.debugPendingJobs)return result;
        h.advanceFrame();
    }
    assert.fail(`${label} did not settle within 128 frames`);
}
function blocking(f,request=f.request,range=32){return settled(f,()=>f.nav.blockingObstacle(request,range),'blocking');}
function normal(f,request=f.request){return settled(f,()=>f.nav.nextVelocity(request,new base.cc.Vec2()),'normal');}
function magnitude(v){return Math.hypot(v.x,v.y);}
function productionEnvelope(Type) {
    const name=Type===EnemyMinion?'minion':'boss';
    const source=`assets/resources/prefabs/character/enemy/pref_enemy_${name}.prefab`;
    const data=JSON.parse(fs.readFileSync(path.join(root,source),'utf8'));
    const c=data.find(n=>/cc\.(Box|Circle)Collider2D/.test(n.__type__));assert(c,'production collider missing');
    const scale=data[c.node.__id__]._lscale;
    return {source,colliderType:c.__type__,width:(c._size?.width??2*c._radius)*Math.abs(scale.x),
        height:(c._size?.height??2*c._radius)*Math.abs(scale.y),offsetX:c._offset.x*scale.x,offsetY:c._offset.y*scale.y};
}
function enemy(f,Type,{visual=true,target=f.target}={}) {
    const envelope=productionEnvelope(Type);
    // Use the current prefab's collider shape and world envelope, including its offset.
    f.body={width:envelope.width,height:envelope.height,offsetX:envelope.offsetX,offsetY:envelope.offsetY};
    f.request={...f.request,body:f.body,target,role:Type===EnemyMinion?'minion':'boss'};
    const Shape=envelope.colliderType==='cc.CircleCollider2D'?base.cc.CircleCollider2D:base.cc.BoxCollider2D;
    const n=f.unit,b=new Shape();b.node=n;b.enabled=true;b.sensor=false;
    if(Shape===base.cc.CircleCollider2D)b.radius=f.body.width/2;
    else b.size={width:f.body.width,height:f.body.height};
    b.offset={x:f.body.offsetX,y:f.body.offsetY};
    n.worldScale={x:1,y:1,z:1};n.worldRotation={x:0,y:0,z:0,w:1};
    Object.defineProperty(b,'worldAABB',{get(){const p=pos(n);return new base.cc.Rect(p.x+f.body.offsetX-f.body.width/2,
        p.y+f.body.offsetY-f.body.height/2,f.body.width,f.body.height);}});
    n.components.set(Shape,b);n.components.set(base.cc.Collider2D,b);n.addComponent(base.cc.RigidBody2D);
    const e=n.addComponent(Type);if(visual)e.visualNode=n.add(h.eventNode('Visual'));e.onLoad();
    if(Type===EnemyMinion){e.setTarget(target);e.setForceChaseTarget(true);}
    else{e._upsertTarget(target,target===f.target?'player':'building');e._lockedTarget=target;e._retargetTimer=999;e._targetScanTimer=999;}
    return e;
}
function step(f,e,dt=.25) {
    const before=pos(f.unit);e._ai?.update(dt);e.update(dt);
    const v=e._rb.linearVelocity??new base.cc.Vec2(),after={x:before.x+v.x*dt,y:before.y+v.y*dt};
    assert(f.nav._field.lineClear(before,after,f.body,f.nav._area),'movement crossed current solid geometry');
    f.unit.set(after.x,after.y);sample(f,'update');h.advanceFrame();return magnitude(v);
}
function advanceToAttack(f,e) {
    const start=pos(f.unit);let frame=0,diversionFrame=null;
    const speed=e instanceof EnemyMinion?GameConfig.minionMoveSpeed:GameConfig.bossMoveSpeed;
    const maxFrames=128+Math.ceil(800/(speed*.25));
    for(;frame<maxFrames&&!e._isAttacking;frame++){step(f,e);if(e._blockingObstacle&&diversionFrame===null)diversionFrame=frame;}
    assert(e._isAttacking,`no attack after ${frame} frames: ${JSON.stringify({position:pos(f.unit),target:!!e._blockingObstacle,jobs:f.nav._field.debugPendingJobs})}`);
    assert.strictEqual(e._blockingObstacle,f.log.n);
    assert(f.nav.canAttackObstacle(f.unit,f.log.n,f.body,e instanceof EnemyMinion?32:Math.max(e.attackTriggerRange,48)));
    return {frame,diversionFrame,moved:Math.hypot(pos(f.unit).x-start.x,pos(f.unit).y-start.y),at:pos(f.unit),body:f.body};
}
function recovery(e){return e._scheduled.filter(s=>s.delay===(e instanceof EnemyMinion ? .8 : 1.2)).at(-1).cb;}

test('AC-UNIFIED: a collider gap is usable without castle or entrance configuration',()=>{
    const f=fixture({logRect:{xMin:-117.5,xMax:10,yMin:-9.5,yMax:9.5}});
    assert.strictEqual(blocking(f),null);assert(magnitude(normal(f))>0);
    assert(!f.nav._area.castlePolygon);assert(!f.nav._area.portals);f.nav.destroy();
});
test('AC-NEGATIVE: a full hard seal cannot be traversed or demolished',()=>{
    const f=fixture();mark(f.log.n,Kind.Hard);assert.strictEqual(blocking(f),null);assert.strictEqual(magnitude(normal(f)),0);
    assert(!f.nav.canAttackObstacle(f.unit,f.log.n,f.body,300));f.nav.destroy();
});
test('AC-NONLOG: an additional hard divider makes destroying the log pointless',()=>{
    const f=fixture();f.box('airWall-second-seal',{xMin:-300,xMax:300,yMin:90,yMax:110});
    assert.strictEqual(blocking(f),null);assert.strictEqual(magnitude(normal(f)),0);f.nav.destroy();
});
test('AC-CLASSIFY: unsupported Destructible stays solid; Ignore overrides compatibility',()=>{
    const f=fixture();f.log.n.components.delete(Log);mark(f.log.n,Kind.Destructible);
    assert.strictEqual(blocking(f),null);assert.strictEqual(magnitude(normal(f)),0);
    mark(f.log.n,Kind.Ignore);h.advanceFrame();assert.strictEqual(blocking(f),null);assert(magnitude(normal(f))>0);f.nav.destroy();
});
test('AC-CANDIDATES: unrelated living Building and Barrier do not suppress blocking Log',()=>{
    const f=fixture();f.box('unrelated-building',{xMin:160,xMax:200,yMin:140,yMax:190},base.classes.Building);
    f.box('unrelated-barrier',{xMin:-200,xMax:-160,yMin:140,yMax:190},base.classes.Barrier);
    assert(blocking(f)?.target===f.log.n);f.nav.destroy();
});
test('AC-DYNAMIC: classification changes without AABB movement invalidate the decision',()=>{
    const f=fixture();assert(blocking(f)?.target===f.log.n);const version=f.nav._area.obstacleVersion;
    mark(f.log.n,Kind.Hard);h.advanceFrame();assert.strictEqual(blocking(f),null);assert(f.nav._area.obstacleVersion>version);
    mark(f.log.n,Kind.Destructible);h.advanceFrame();assert(blocking(f)?.target===f.log.n);
    mark(f.log.n,Kind.Ignore);h.advanceFrame();assert.strictEqual(blocking(f),null);assert(magnitude(normal(f))>0);f.nav.destroy();
});
test('AC-PHASE: fixed Log changes to rolling, charging or failed without stale demolition',()=>{
    for(const phase of ['rolling','charging','failed']){const f=fixture();assert(blocking(f)?.target===f.log.n);
        f.log.c._phase=phase;f.log.c._isLocked=false;h.advanceFrame();assert.strictEqual(blocking(f),null);
        assert(!f.nav.canAttackLog(f.unit,f.log.c,f.body,300));f.nav.destroy();}
});
test('AC-MULTI-COLLIDER: both colliders belong to the same Log and either can be attacked',()=>{
    const f=fixture(),second=f.collider(f.log.n,{xMin:-20,xMax:20,yMin:50,yMax:80});
    f.unit.set(0,100);f.nav._prepareFrame();assert(f.nav._rectByCollider.has(second));
    assert(f.nav.canAttackObstacle(f.unit,f.log.n,f.body,32),'near second collider, beyond range of first');
    const route=settled(f,()=>f.nav.obstacleRoute(f.unit,f.log.n,f.body,32));assert(route);
    f.unit.set(route.point.x,route.point.y);assert(f.nav.canAttackObstacle(f.unit,f.log.n,f.body,32));f.nav.destroy();
});
for(const Type of [EnemyMinion,EnemyBoss]) {
    test(`AC-LIFECYCLE: ${Type.name} moves, hits once, destroys and resumes original objective`,()=>{
        const f=fixture(),e=enemy(f,Type),damage=Type===EnemyMinion?GameConfig.minionAttackDamage:GameConfig.bossAttackDamage;
        f.log.c._hp=damage;const details=advanceToAttack(f,e);assert(details.moved>0);assert(details.diversionFrame<128);
        const hit=base.getHit(),eventsBefore=events.length;hit();hit();assert.strictEqual(f.log.c._hp,0);
        assert(!f.log.b.enabled);assert(events.slice(eventsBefore).some(a=>a[1]===f.log.n&&a[2]===0));
        recovery(e)();const before=pos(f.unit);for(let i=0;i<128;i++){step(f,e);if(pos(f.unit).y>before.y+.001)break;}
        assert.strictEqual(e._blockingObstacle,null);assert(pos(f.unit).y>before.y);
        assert.strictEqual(Type===EnemyMinion?e._target:e._lockedTarget,f.target);f.nav.destroy();return details;
    });
    test(`AC-ALTERNATE: ${Type.name} follows the existing gap without damaging Log`,()=>{
        const f=fixture({logRect:{xMin:-117.5,xMax:-35,yMin:-9.5,yMax:9.5}}),e=enemy(f,Type),hp=f.log.c._hp;
        const speed=Type===EnemyMinion?GameConfig.minionMoveSpeed:GameConfig.bossMoveSpeed;
        for(let i=0;i<128+Math.ceil(600/(speed*.25));i++){step(f,e);assert.strictEqual(e._blockingObstacle,null);if(pos(f.unit).y>50)break;}
        assert(pos(f.unit).y>50,'must actually cross the gap');assert.strictEqual(f.log.c._hp,hp);f.nav.destroy();
    });
    test(`AC-GENERATION: ${Type.name} old same-life hit/recovery cannot affect next attack`,()=>{
        const f=fixture(),e=enemy(f,Type);advanceToAttack(f,e);const oldHit=base.getHit(),oldRecovery=recovery(e);
        const beforeHp=f.log.c._hp,damage=Type===EnemyMinion?GameConfig.minionAttackDamage:GameConfig.bossAttackDamage;
        oldHit();oldHit();assert.strictEqual(f.log.c._hp,beforeHp-damage);oldRecovery();e._ai?.update(5);e._attackTimer=0;e.update(.01);assert(e._isAttacking);
        const hp=f.log.c._hp;oldHit();oldRecovery();assert.strictEqual(f.log.c._hp,hp);assert(e._isAttacking);
        base.getHit()();assert(f.log.c._hp<hp);f.nav.destroy();
    });
    test(`AC-POOL: ${Type.name} old hit/recovery/death cannot affect reused unit`,()=>{
        const f=fixture(),e=enemy(f,Type);advanceToAttack(f,e);const hit=base.getHit(),recover=recovery(e);let returns=0;
        e.onReturnedToPool=()=>returns++;e.takeDamage(999999);
        const death=e._scheduled.find(s=>s.delay===(Type===EnemyMinion ? .5 : .8)).cb;e.onDisable();e.reset();
        if(Type===EnemyMinion){e.setTarget(f.target);e.setForceChaseTarget(true);}
        else{e._lockedTarget=f.target;e._retargetTimer=999;e._targetScanTimer=999;}
        advanceToAttack(f,e);const hp=f.log.c._hp;hit();recover();death();death();
        assert.strictEqual(f.log.c._hp,hp);assert(e._isAttacking);assert.strictEqual(returns,0);
        base.getHit()();assert(f.log.c._hp<hp);e.onDestroy();assert(!f.nav._registeredUnits.has(f.unit));f.nav.destroy();
    });
    test(`AC-DAMAGE: ${Type.name} no Visual hits once through real fallback`,()=>{
        const f=fixture(),e=enemy(f,Type,{visual:false}),hp=f.log.c._hp;advanceToAttack(f,e);
        const damage=Type===EnemyMinion?GameConfig.minionAttackDamage:GameConfig.bossAttackDamage;
        assert.strictEqual(f.log.c._hp,hp-damage);e.tryAttack();assert.strictEqual(f.log.c._hp,hp-damage);f.nav.destroy();
    });
    test(`AC-HIT-SAFETY: ${Type.name} moved/changed/hard target invalidates pending hit`,()=>{
        for(const mode of ['range','phase','hard','original-target']) {
            const f=fixture(),e=enemy(f,Type);advanceToAttack(f,e);const hit=base.getHit(),hp=f.log.c._hp;
            if(mode==='range')f.unit.set(0,-240);
            if(mode==='phase'){f.log.c._phase='rolling';f.log.c._isLocked=false;}
            if(mode==='hard')mark(f.log.n,Kind.Hard);
            if(mode==='original-target')f.target.activeInHierarchy=false;
            h.advanceFrame();hit();assert.strictEqual(f.log.c._hp,hp,mode);f.nav.destroy();
        }
    });
    test(`AC-MOVING-TARGET: ${Type.name} releases demolition when original target becomes reachable`,()=>{
        const f=fixture(),e=enemy(f,Type);for(let i=0;i<128&&!e._blockingObstacle;i++)step(f,e);
        assert(e._blockingObstacle===f.log.n);f.target.set(100,-200);step(f,e);
        assert.strictEqual(e._blockingObstacle,null);assert.strictEqual(Type===EnemyMinion?e._target:e._lockedTarget,f.target);f.nav.destroy();
    });
    test(`AC-GENERIC-DAMAGE: ${Type.name} uses the marked Building damage adapter`,()=>{
        const f=fixture();f.log.n.components.delete(Log);const building=f.log.n.addComponent(base.classes.Building);
        mark(f.log.n,Kind.Destructible);let hp=1,hits=0;
        building.takeDamage=amount=>{hits++;hp-=amount;if(hp<=0){building.alive=false;f.log.n.active=false;f.log.b.enabled=false;}};
        const e=enemy(f,Type);advanceToAttack(f,e);const hit=base.getHit();hit();hit();assert.strictEqual(hits,1);assert(hp<=0);
        recovery(e)();for(let i=0;i<128&&e._blockingObstacle;i++)step(f,e);
        assert.strictEqual(e._blockingObstacle,null);f.nav.destroy();
    });
}
test('AC-BOSS-BUILDING: locked Building behind Log is resumed after actual Log destruction',()=>{
    const f=fixture(),building=f.box('original-building',{xMin:-35,xMax:35,yMin:150,yMax:210},base.classes.Building);
    let damage=0;building.c.takeDamage=n=>damage+=n;
    const e=enemy(f,EnemyBoss,{target:building.n});f.log.c._hp=GameConfig.bossAttackDamage;
    const details=advanceToAttack(f,e);assert.strictEqual(e._lockedTarget,building.n);base.getHit()();assert.strictEqual(f.log.c._hp,0);
    recovery(e)();for(let i=0;i<600&&damage===0;i++){step(f,e);if(e._isAttacking)base.getHit()();}
    assert(damage>0);assert.strictEqual(e._lockedTarget,building.n);assert.strictEqual(e._blockingObstacle,null);f.nav.destroy();return details;
});
test('AC-SHARED: 200 units x 300 stable frames reuse settled diagnostics without rescanning',()=>{
    const f=fixture();assert(blocking(f)?.target===f.log.n);
    const units=Array.from({length:200},(_,i)=>f.node(`peer-${i}`,i%10-5,-180));
    const before={...f.nav.debugStats,graphs:f.nav._field.debugGraphBuildCount,fields:f.nav._field.buildCount};
    for(let frame=0;frame<300;frame++){h.advanceFrame();for(const unit of units)assert(f.nav.blockingObstacle({...f.request,unit},32)?.target===f.log.n);}
    const after={...f.nav.debugStats,graphs:f.nav._field.debugGraphBuildCount,fields:f.nav._field.buildCount};
    for(const key of ['fullSceneScan','blockingScans','surfaceScans','graphs','fields'])assert.strictEqual(after[key],before[key],key);
    sample(f,'shared');f.nav.destroy();assert.strictEqual(f.nav._field.debugBytes,0);return {before,after};
});
test('AC-INVALIDATE: a building inserted while a graph is pending cancels obsolete work',()=>{
    const f=fixture();assert.strictEqual(f.nav.blockingObstacle(f.request,32),null);assert(f.nav._field.debugPendingJobs>0);
    const version=f.nav._area.obstacleVersion;f.box('airWall-new-building',{xMin:-300,xMax:300,yMin:90,yMax:110});
    assert.strictEqual(blocking(f),null);assert(f.nav._area.obstacleVersion>version);assert(f.nav._field.debugJobStats.cancelled>0);
    assert.strictEqual(magnitude(normal(f)),0);f.nav.destroy();
});
fs.writeFileSync(path.join(evidenceDir,'tests.json'),JSON.stringify({results,frameSamples},null,2));
