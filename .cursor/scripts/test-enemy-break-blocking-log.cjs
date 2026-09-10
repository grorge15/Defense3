const assert = require('assert');
const fs = require('fs');
const path = require('path');
const previous = process.env.NAV_HARNESS_ONLY;
process.env.NAV_HARNESS_ONLY = '1';
const h = require('./test-enemy-navigation.cjs');
if (previous === undefined) delete process.env.NAV_HARNESS_ONLY;
else process.env.NAV_HARNESS_ONLY = previous;
const root = path.resolve(__dirname, '../..');
const evidenceDir = path.resolve(root, process.env.NAV_EVIDENCE_DIR || '.cursor/plans/reports/enemy-break-blocking-log-evidence');
fs.mkdirSync(evidenceDir, {recursive:true});
const p = name => path.join(root, `assets/scripts/${name}.ts`);
const base = h.actualScriptMocks();
base.mocks[p('game/CoinSystem')] = { CoinSystem: class { static instance=null; } };
delete base.mocks[p('core/EnemyNavigation')];
delete base.mocks[p('item/Log')];
const { GameConfig } = h.loadTs('assets/scripts/core/GameConfig.ts');
base.mocks[p('core/GameConfig')].GameConfig = GameConfig;
base.mocks[p('core/TweenUtil')] = { TweenUtil: { fadeOutOpacity(_node, _time, cb) { cb?.(); } } };
const events = [];
base.mocks[p('core/EventManager')].EventManager.instance.emitEvent = (...args) => events.push(args);
const { Log } = h.loadTs('assets/scripts/item/Log.ts', base.mocks);
base.mocks[p('item/Log')] = { Log };
const { EnemyNavigation } = h.loadTs('assets/scripts/core/EnemyNavigation.ts', base.mocks);
const { EnemyAI } = h.loadTs('assets/scripts/enemy/EnemyAI.ts', base.mocks);
const { EnemyMinion } = h.loadTs('assets/scripts/enemy/EnemyMinion.ts', base.mocks);
const { EnemyBoss } = h.loadTs('assets/scripts/enemy/EnemyBoss.ts', base.mocks);
const results = [];
function test(name, fn) {
    try { const details = fn(); results.push({ name, passed: true, details }); console.log(`ok - ${name}`); }
    catch (e) { results.push({ name, passed: false, error: e.stack }); console.error(`not ok - ${name}\n${e.stack}`); process.exitCode = 1; }
}
function pos(node) { const v=new base.cc.Vec3(); node.getWorldPosition(v); return v; }
function fixture(options = {}) {
    const scene = h.eventNode('scene'); scene.scene = scene;
    const node = (name, x, y) => scene.add(h.eventNode(name, x, y));
    const nav = EnemyNavigation.get(scene);
    const ground = [[-200,-200],[200,-200],[200,200],[-200,200]].map(([x,y]) => node('ground',x,y));
    const castle = [[-200,0],[200,0],[200,200],[-200,200]].map(([x,y]) => node('castle',x,y));
    nav.configure({ boundsMin: ground[0], boundsMax: ground[2], walkablePolygon: ground, castlePolygon: castle,
        entrances: [-130,0,130].map((x,i) => ({ id:i+1, outside:node('outside',x,-60), inside:node('inside',x,60),
            closePlot:null, width:60, open:i===1 || !!options.alternate })) });
    function box(name, rect, Type) {
        const n = node(name, (rect.xMin+rect.xMax)/2,(rect.yMin+rect.yMax)/2);
        const b = new base.cc.BoxCollider2D(); b.node=n; b.enabled=true;
        b.worldAABB=new base.cc.Rect(rect.xMin,rect.yMin,rect.xMax-rect.xMin,rect.yMax-rect.yMin);
        n.components.set(base.cc.BoxCollider2D,b);
        let c;
        if (Type) { c = new Type(); c.node=n; n.components.set(Type,c); }
        scene.emit('component-added', b);
        return { n,b,c };
    }
    const r = options.rect || {xMin:-70,xMax:70,yMin:-65,yMax:15};
    const log = box('log',r,Log); log.c._phase='fixed'; log.c._isLocked=true; log.c._hp=GameConfig.logMaxHp; log.c._collider=log.b;
    const unit = node('unit',0,-150), target=node('player',0,140);
    const player = new base.classes.Player(); player.node=target; target.components.set(base.classes.Player,player);
    const body = options.body || {width:10,height:10};
    const req = {unit,target,body,role:'minion',speed:40,dt:0.1,stopDistance:32};
    return {scene,node,nav,log,unit,target,body,req,box};
}
test('AC-ENTRY: endpoint obstruction selects a legal reachable surface and advances to damage range', () => {
    const f=fixture();
    const diversion=f.nav.blockingLog(f.req,32);
    assert.strictEqual(diversion?.log,f.log.c);
    let moved=false;
    for(let i=0;i<100;i++) {
        const v=f.nav.nextLogVelocity(f.req,diversion,new base.cc.Vec2());
        moved ||= Math.hypot(v.x,v.y)>0;
        const at=pos(f.unit); f.unit.set(at.x+v.x*0.1,at.y+v.y*0.1); h.advanceFrame();
        assert(f.nav._field.pointWalkable(pos(f.unit),f.body,f.nav._area));
        if(f.nav.canAttackLog(f.unit,f.log.c,f.body,32)) break;
    }
    assert(moved); assert(f.nav.canAttackLog(f.unit,f.log.c,f.body,32)); f.nav.destroy();
});
test('AC-ALTERNATE: another legal entrance keeps the original target', () => {
    const f=fixture({alternate:true}); assert.strictEqual(f.nav.blockingLog(f.req,32),null); f.nav.destroy();
});
test('AC-NONLOG: removing only the log cannot bypass a second sealed barrier', () => {
    const f=fixture(); f.box('airWall-seal',{xMin:-200,xMax:200,yMin:80,yMax:100});
    assert.strictEqual(f.nav.blockingLog(f.req,32),null); f.nav.destroy();
});
function enemy(f, Type, ordinaryLog=false, visual=true, prefab=null) {
    const n=f.unit, b=new base.cc.BoxCollider2D(); b.node=n; b.enabled=true;
    b.size=prefab?.size || {width:f.body.width,height:f.body.height};
    b.offset=prefab?.offset || {x:f.body.offsetX||0,y:f.body.offsetY||0};
    n.worldScale=prefab?.scale || {x:1,y:1,z:1}; n.worldRotation={x:0,y:0,z:0,w:1};
    Object.defineProperty(b,'worldAABB',{get(){ const at=pos(n),body=EnemyNavigation.bodyForCollider(b);
        return new base.cc.Rect(at.x+body.offsetX-body.width/2,at.y+body.offsetY-body.height/2,body.width,body.height); }});
    n.components.set(base.cc.BoxCollider2D,b); n.components.set(base.cc.Collider2D,b);
    n.addComponent(base.cc.RigidBody2D);
    const e=n.addComponent(Type);
    if(visual) {
        e.visualNode=prefab ? n.add(h.eventNode('Visual')) : f.node('Visual',0,0);
        if(prefab) {
            e.visualNode.worldScale={x:prefab.scale.x*prefab.visualScale.x,y:prefab.scale.y*prefab.visualScale.y,z:1};
            const ui=e.visualNode.addComponent(base.cc.UITransform);
            ui.contentSize=prefab.contentSize; ui.anchorPoint=prefab.anchorPoint;
        }
    }
    e.onLoad();
    if(Type===EnemyMinion) { e.setTarget(f.target); e.setForceChaseTarget(true); }
    else { e._upsertTarget(f.target,'player'); if(ordinaryLog) e._upsertTarget(f.log.n,'log');
        e._lockedTarget=ordinaryLog ? f.log.n : f.target; e._retargetTimer=999; e._targetScanTimer=999; }
    return e;
}
function step(f,e,dt=0.05) {
    e._ai?.update(dt); e.update(dt);
    const v=e._rb.linearVelocity, at=pos(f.unit);
    f.unit.set(at.x+(v?.x||0)*dt,at.y+(v?.y||0)*dt); h.advanceFrame();
    assert(f.nav._field.pointWalkable(pos(f.unit),f.body,f.nav._area),'movement overlaps real obstacle');
}
function advanceToAttack(f,e) {
    const start=pos(f.unit);
    const speed=e instanceof EnemyMinion?GameConfig.minionMoveSpeed:GameConfig.bossMoveSpeed;
    const maxFrames=Math.ceil(800/speed/0.25);
    for(let i=0;i<maxFrames && !e._isAttacking;i++) step(f,e,0.25);
    assert(e._isAttacking,`real update must reach attack: ${JSON.stringify({at:pos(f.unit),velocity:e._velocity,
        temporary:!!e._blockingLog,body:e._bodySize(),aiBody:e._ai?._body(),phase:f.log.c.getPhase(),
        route:f.nav.blockingLog(f.req,32)?.point,canHit:f.nav.canAttackLog(f.unit,f.log.c,f.body,32)})}`);
    return Math.hypot(pos(f.unit).x-start.x,pos(f.unit).y-start.y);
}
for(const Type of [EnemyMinion,EnemyBoss]) for(const endpoint of [true,false]) {
    test(`AC-ENTRY/DAMAGE: ${Type.name} real update and frame, endpoint=${endpoint}`,()=>{
        const f=fixture({rect:endpoint?undefined:{xMin:-70,xMax:70,yMin:-15,yMax:15}}),e=enemy(f,Type);
        const hp=f.log.c._hp;
        assert(advanceToAttack(f,e)>0); assert.strictEqual(f.log.c._hp,hp);
        assert.strictEqual(e._blockingLog,f.log.c);
        const hit=base.getHit(); hit(); hit();
        const damage=Type===EnemyMinion?GameConfig.minionAttackDamage:GameConfig.bossAttackDamage;
        assert.strictEqual(f.log.c._hp,hp-damage); assert.strictEqual(f.target.getComponent(base.classes.Player).damage,0);
        e.tryAttack(); assert.strictEqual(f.log.c._hp,hp-damage);
        assert.strictEqual(Type===EnemyMinion?e._target:e._lockedTarget,f.target);
        f.nav.destroy();
    });
}
test('AC-BOSS-ORDINARY: normal-priority locked Log uses surface movement and deduplicated circle hit',()=>{
    const f=fixture(), e=enemy(f,EnemyBoss,true); const hp=f.log.c._hp;
    assert.strictEqual(e.pickTarget(),f.log.n); assert(advanceToAttack(f,e)>0);
    assert.strictEqual(e._blockingLog,null); base.getHit()();
    assert.strictEqual(f.log.c._hp,hp-GameConfig.bossAttackDamage);
    assert.strictEqual(e.pickTarget(),f.log.n); f.nav.destroy();
});
for(const Type of [EnemyMinion,EnemyBoss]) {
    test(`AC-RESUME: ${Type.name} real destruction, HP event, collider removal and original pursuit`,()=>{
        const f=fixture(), e=enemy(f,Type), damage=Type===EnemyMinion?GameConfig.minionAttackDamage:GameConfig.bossAttackDamage;
        f.log.c._hp=damage; advanceToAttack(f,e); const old=pos(f.unit); const count=events.length;
        base.getHit()(); assert.strictEqual(f.log.c._hp,0); assert.strictEqual(f.log.b.enabled,false);
        assert(events.slice(count).some(a=>a[1]===f.log.n&&a[2]===0));
        e._scheduled.find(s=>s.delay===(Type===EnemyMinion?0.8:1.2)).cb();
        step(f,e); assert.strictEqual(e._blockingLog,null);
        assert.strictEqual(Type===EnemyMinion?e._target:e._lockedTarget,f.target);
        assert(!f.nav._rectByCollider.has(f.log.b));
        assert(Math.hypot(pos(f.unit).x-old.x,pos(f.unit).y-old.y)>0); f.nav.destroy();
    });
    test(`AC-DAMAGE: ${Type.name} no Visual single fallback and stale target before frame`,()=>{
        let f=fixture(),e=enemy(f,Type,false,false); const hp=f.log.c._hp;
        advanceToAttack(f,e); const damage=Type===EnemyMinion?GameConfig.minionAttackDamage:GameConfig.bossAttackDamage;
        assert.strictEqual(f.log.c._hp,hp-damage); e.tryAttack(); assert.strictEqual(f.log.c._hp,hp-damage); f.nav.destroy();
        for(const state of ['range','destroyed','phase']) {
            f=fixture(); e=enemy(f,Type); advanceToAttack(f,e); const hit=base.getHit();
            if(state==='range') f.unit.set(150,-150);
            if(state==='destroyed') f.log.c.takeDamage(GameConfig.logMaxHp);
            if(state==='phase') f.log.c._phase='rolling';
            const before=f.log.c._hp; h.advanceFrame(); hit(); assert.strictEqual(f.log.c._hp,before); f.nav.destroy();
        }
    });
    test(`AC-POOL: ${Type.name} old hit/recovery/death after disable/reset and new attack`,()=>{
        const f=fixture(),e=enemy(f,Type); advanceToAttack(f,e);
        const oldHit=base.getHit(), oldRecovery=e._scheduled.find(s=>s.delay===(Type===EnemyMinion?0.8:1.2)).cb;
        let returned=0; e.onReturnedToPool=()=>returned++;
        e.takeDamage(999999); const oldDeath=e._scheduled.find(s=>s.delay===(Type===EnemyMinion?0.5:0.8)).cb;
        e.onDisable(); e.reset();
        if(Type===EnemyMinion) {e.setTarget(f.target);e.setForceChaseTarget(true);}
        else {e._lockedTarget=f.target;e._retargetTimer=999;e._targetScanTimer=999;}
        advanceToAttack(f,e); const hp=f.log.c._hp;
        oldHit(); oldRecovery(); oldDeath(); oldDeath();
        assert.strictEqual(f.log.c._hp,hp); assert(e._isAttacking); assert.strictEqual(returned,0); assert(f.unit.active);
        base.getHit()(); assert(f.log.c._hp<hp); e.onDestroy(); assert.strictEqual(e._blockingLog,null);
        assert(!f.nav._registeredUnits.has(f.unit)); f.nav.destroy();
    });
}
test('AC-SAME: same-side inside/outside and nonnull replacement do not prove objective reachability',()=>{
    for(const y of [-100,100]) {
        const f=fixture({rect:{xMin:-5,xMax:5,yMin:-200,yMax:200}});
        f.unit.set(-30,y); f.target.set(20,y);
        assert(f.nav.blockingLog(f.req,32));
        assert(f.nav._field.nearestReachableWalkable(pos(f.unit),pos(f.target),f.body,f.nav._area,8));
        assert(!f.nav._field.canReach(pos(f.unit),pos(f.target),f.body,f.nav._area)); f.nav.destroy();
    }
});
test('AC-SAME: Minion 32/50 early hold cannot suppress the blocking-log attack',()=>{
    const f=fixture({rect:{xMin:-2,xMax:2,yMin:-200,yMax:200},body:{width:2,height:2}});
    f.unit.set(-10,-100);f.target.set(10,-100);const e=enemy(f,EnemyMinion);e._inAttackHysteresis=true;
    e.update(0.1);assert.strictEqual(e._blockingLog,f.log.c);assert(e._isAttacking);
    const hp=f.log.c._hp;base.getHit()();assert.strictEqual(f.log.c._hp,hp-GameConfig.minionAttackDamage); f.nav.destroy();
});
test('AC-MOVING: real Log eligibility and cached fixed-to-moving transitions',()=>{
    const f=fixture(); assert(f.nav.blockingLog(f.req,32));
    for(const phase of ['rolling','charging','failed']) {
        f.log.c._phase=phase;h.advanceFrame();assert.strictEqual(f.nav.blockingLog(f.req,32),null);
        assert(!f.nav.canAttackLog(f.unit,f.log.c,f.body,999));
    }
    f.log.c._phase='fixed';f.log.n.active=false;h.advanceFrame();assert.strictEqual(f.nav.blockingLog(f.req,32),null);
    f.log.n.active=true;f.log.c._isLocked=false;h.advanceFrame();assert.strictEqual(f.nav.blockingLog(f.req,32),null);f.nav.destroy();
});
test('AC-ALTERNATE/NONLOG: direct, same-side detour, no Log, illegal shortcut and missing config',()=>{
    const f=fixture();f.target.set(140,-150);assert.strictEqual(f.nav.blockingLog(f.req,32),null);
    f.target.set(160,-30);assert.strictEqual(f.nav.blockingLog(f.req,32),null);
    f.log.n.active=false;f.log.n.activeInHierarchy=false;f.target.set(0,140);h.advanceFrame();assert.strictEqual(f.nav.blockingLog(f.req,32),null);
    f.log.n.active=true;f.log.n.activeInHierarchy=true;f.nav._entrances.get(2).open=false;f.nav.invalidate();
    assert.strictEqual(f.nav.blockingLog(f.req,32),null); assert(!f.nav.hasLineOfSight(f.unit,f.target,f.body));
    f.nav.configure({walkablePolygon:[]});assert.strictEqual(f.nav.blockingLog(f.req,32),null);
    assert(!f.nav.canAttackLog(f.unit,f.log.c,f.body,999));f.nav.destroy();
});
test('AC-SURFACE: long log, offsets, alternate faces, thin non-log occlusion and large dt',()=>{
    for(const body of [{width:10,height:10,offsetX:9,offsetY:-8},{width:30,height:20,offsetX:-12,offsetY:15}]) {
        const f=fixture({body,rect:{xMin:-150,xMax:150,yMin:-65,yMax:15}});
        const route=f.nav.blockingLog(f.req,32);assert(route);
        assert(f.nav._field.pointWalkable(route.point,body,f.nav._area));assert(f.nav._field.canReach(pos(f.unit),route.point,body,f.nav._area));
        f.unit.set(route.point.x,route.point.y);assert(f.nav.canAttackLog(f.unit,f.log.c,body,32));
        const b={width:0,height:0}; const before=pos(f.unit);
        const v=new base.cc.Vec2(0,10000);f.nav.constrainFinalVelocity(f.unit,body,10,10000,v);
        const after={x:before.x+v.x*10,y:before.y+v.y*10};assert(f.nav._field.lineClear(before,after,body,f.nav._area));f.nav.destroy();
    }
    const f=fixture();f.box('airWall-edge',{xMin:-200,xMax:200,yMin:-85,yMax:-84});
    f.unit.set(0,80);const route=f.nav.logRoute(f.unit,f.log.c,f.body,32);assert(route);assert(route.point.y>15);
    f.unit.set(0,-100);assert(!f.nav.canAttackLog(f.unit,f.log.c,f.body,100));f.nav.destroy();
});
test('AC-SHARED: 200 enemies x 300 frames positive/no-Log/non-Log negative counts',()=>{
    const rows=[];
    for(const mode of ['positive','no-log','non-log']) {
        const f=fixture();
        if(mode==='no-log'){f.log.n.active=false;f.log.n.activeInHierarchy=false;f.box('airWall-seal',{xMin:-200,xMax:200,yMin:-20,yMax:20});}
        if(mode==='non-log')f.box('airWall-seal',{xMin:-200,xMax:200,yMin:80,yMax:100});
        const units=Array.from({length:200},(_,i)=>f.node('u'+i,-5+i%10,-150));
        for(const unit of units) f.nav.blockingLog({...f.req,unit},32);
        const before={...f.nav.debugStats,graphs:f.nav._field.debugGraphBuildCount,fields:f.nav._field.buildCount};
        for(let frame=0;frame<300;frame++){h.advanceFrame();for(const unit of units)assert.strictEqual(!!f.nav.blockingLog({...f.req,unit},32),mode==='positive');}
        const after={...f.nav.debugStats,graphs:f.nav._field.debugGraphBuildCount,fields:f.nav._field.buildCount};
        for(const key of ['fullSceneScan','blockingScans','surfaceScans','graphs','fields'])assert.strictEqual(after[key]-before[key],0,mode+key);
        assert.strictEqual(after.trackedColliderChecks-before.trackedColliderChecks,300*(mode==='positive'?1:2));
        rows.push({mode,before,after,entries:f.nav._field.debugEntries,bytes:f.nav._field.debugBytes});f.nav.destroy();
    }
    return rows;
});
test('AC-SURFACE: contact stance blocked but a farther in-range stance can hit through a narrow slot',()=>{
    const f=fixture({body:{width:20,height:20},rect:{xMin:-200,xMax:200,yMin:-20,yMax:20}});
    f.box('airWall-left',{xMin:-200,xMax:-6,yMin:-50,yMax:-20});
    f.box('airWall-right',{xMin:6,xMax:200,yMin:-50,yMax:-20});
    f.unit.set(0,-100);
    assert(!f.nav._field.pointWalkable({x:0,y:-30.05},f.body,(f.nav._prepareFrame(),f.nav._area)));
    const route=f.nav.logRoute(f.unit,f.log.c,f.body,32);assert(route,'farther stance must be considered');
    assert(route.point.y<-60);f.unit.set(route.point.x,route.point.y);assert(f.nav.canAttackLog(f.unit,f.log.c,f.body,32));
    f.nav.destroy();
});
test('AC-ENTRY-FIXTURE: readonly Main.scene bindings and complete parent transforms',()=>{
    const source='assets/scenes/Main.scene', bytes=fs.readFileSync(path.join(root,source)), scene=JSON.parse(bytes);
    const bindings=scene.filter(n=>n.navBoundsMin&&n.navBoundsMax);assert.strictEqual(bindings.length,1);
    const binding=bindings[0], chains={};
    function world(ref) {
        const id=ref.__id__; let point={...scene[id]._lpos}; const chain=[];
        for(let parent=scene[id]._parent;parent;parent=scene[parent.__id__]._parent) {
            const n=scene[parent.__id__],s=n._lscale||{x:1,y:1,z:1},q=n._lrot||{x:0,y:0,z:0,w:1},t=n._lpos||{x:0,y:0,z:0};
            const v={x:point.x*s.x,y:point.y*s.y,z:point.z*s.z};
            const uv={x:q.y*v.z-q.z*v.y,y:q.z*v.x-q.x*v.z,z:q.x*v.y-q.y*v.x};
            const uuv={x:q.y*uv.z-q.z*uv.y,y:q.z*uv.x-q.x*uv.z,z:q.x*uv.y-q.y*uv.x};
            point={x:v.x+2*(q.w*uv.x+uuv.x)+t.x,y:v.y+2*(q.w*uv.y+uuv.y)+t.y,z:v.z+2*(q.w*uv.z+uuv.z)+t.z};
            chain.push({id:parent.__id__,name:n._name,scale:s,rotation:q,position:t});
        }
        chains[id]=chain;return point;
    }
    const geometry={source,sha256:require('crypto').createHash('sha256').update(bytes).digest('hex'),
        boundsMin:world(binding.navBoundsMin),boundsMax:world(binding.navBoundsMax),
        castle:binding.castleArea.map(world),ground:binding.walkableGround.map(world),
        entrances:binding.entrances.map(ref=>{const e=scene[ref.__id__];return {id:e.id,width:e.width,open:e.open,
            outside:world(e.outside),inside:world(e.inside)};}),chains};
    assert.strictEqual(geometry.entrances.length,3);
    const f=fixture();f.log.n.activeInHierarchy=false;f.log.n.active=false;
    const marker=p=>f.node('actual-marker',p.x,p.y);
    f.nav.configure({boundsMin:marker(geometry.boundsMin),boundsMax:marker(geometry.boundsMax),
        castlePolygon:geometry.castle.map(marker),walkablePolygon:geometry.ground.map(marker),
        entrances:geometry.entrances.map(e=>({...e,outside:marker(e.outside),inside:marker(e.inside),closePlot:null,open:e.id===2}))});
    const e=geometry.entrances.find(e=>e.id===2);
    f.unit.set(e.outside.x,e.outside.y);f.target.set(e.inside.x,e.inside.y);
    f.nav._prepareFrame();
    assert(f.nav._field.canReach(pos(f.unit),pos(f.target),f.body,f.nav._area));
    geometry.verifiedMiddleReachable=true;
    fs.writeFileSync(path.join(evidenceDir,'scene-entrances.json'),JSON.stringify(geometry,null,2));
    f.nav.destroy();return geometry;
});
test('AC-CACHE: body/offset/region and exact same-cell terminal conditions are isolated',()=>{
    const f=fixture();assert(f.nav.blockingLog(f.req,32));
    assert.strictEqual(f.nav.blockingLog({...f.req,body:{width:70,height:70}},32),null);
    assert.strictEqual(f.nav.blockingLog({...f.req,body:{width:10,height:10,offsetY:-200}},32),null);
    f.unit.set(0,100);assert.strictEqual(f.nav.blockingLog(f.req,32),null);f.unit.set(0,-150);assert(f.nav.blockingLog(f.req,32));
    const version=f.nav._area.obstacleVersion;f.nav.invalidate();f.nav.blockingLog(f.req,32);assert.strictEqual(f.nav._area.obstacleVersion,version);
    f.nav.setEntranceOpen(1,true);assert.strictEqual(f.nav.blockingLog(f.req,32),null);f.nav.setEntranceOpen(1,false);assert(f.nav.blockingLog(f.req,32));
    f.nav.destroy();
    const g=fixture({rect:{xMin:-5,xMax:5,yMin:-200,yMax:200}});g.unit.set(-100,-100);g.target.set(-11,-100);
    assert.strictEqual(g.nav.blockingLog(g.req,32),null);const c=g.nav._field.worldToCell(pos(g.target),g.nav._area.bounds);
    g.target.set(-9,-100);assert.deepStrictEqual(g.nav._field.worldToCell(pos(g.target),g.nav._area.bounds),c);
    assert(g.nav.blockingLog(g.req,32));g.target.set(-11,-100);assert.strictEqual(g.nav.blockingLog(g.req,32),null);g.nav.destroy();
});
test('AC-CACHE: 10000 queries/1000 revisions, combined diagnostic/query LRU and byte pressure',()=>{
    const f=fixture(),flow=f.nav._field;let hits=0;
    for(let v=0;v<1000;v++) {
        f.log.b.worldAABB.xMin=-70-(v%2);f.nav.invalidate();h.advanceFrame();
        for(let q=0;q<10;q++){if(f.nav.blockingLog(f.req,32))hits++;assert(flow.debugEntries<=32);assert(flow.debugBytes<=8388608);}
    }
    assert.strictEqual(hits,10000);
    const rows=[{queries:10000,revisions:1000,graphs:flow.debugGraphBuildCount,fields:flow.buildCount,
        scans:f.nav.debugStats.blockingScans,peakEntries:flow.debugStats.peakEntries,peakBytes:flow.debugStats.peakBytes}];
    for(const budget of [{entries:8,bytes:8388608,cells:262144},{entries:64,bytes:18000,cells:262144}]) {
        flow.clear();flow._budget=budget;
        for(let i=0;i<50;i++){f.target.set(i%2?0:1,100+i);f.nav.blockingLog(f.req,32+i%3);
            assert(flow.debugEntries<=budget.entries);assert(flow.debugBytes<=budget.bytes);}
        rows.push({budget,entries:flow.debugEntries,bytes:flow.debugBytes});
    }
    f.nav.resetUnit(f.unit);assert(!f.nav._unitState.has(f.unit));f.nav.destroy();assert.strictEqual(flow.debugEntries,0);assert.strictEqual(flow.debugBytes,0);
    return rows;
});
for(const Type of [EnemyMinion,EnemyBoss])test(`AC-RESUME: ${Type.name} external destruction, moving objective and invalidation`,()=>{
    const f=fixture(),e=enemy(f,Type);step(f,e);assert(e._blockingLog===f.log.c);
    f.target.set(140,-150);step(f,e);assert.strictEqual(e._blockingLog,null);assert(!e._isAttacking);
    f.target.set(0,140);step(f,e);assert(e._blockingLog===f.log.c);
    f.log.c.takeDamage(GameConfig.logMaxHp);step(f,e);assert.strictEqual(e._blockingLog,null);
    f.target.activeInHierarchy=false;step(f,e);assert.strictEqual(e._blockingLog,null);f.nav.destroy();
});
test('AC-TARGET: Minion external assignment cancels old hit/recovery without polluting the next attack',()=>{
    const f=fixture(),e=enemy(f,EnemyMinion);advanceToAttack(f,e);const hit=base.getHit();
    const recovery=e._scheduled.find(s=>s.delay===0.8).cb, replacement=f.node('replacement',0,140);
    replacement.components.set(base.classes.Player,new base.classes.Player());e.setTarget(replacement);
    e._ai.update(2);e.update(0.1);assert(e._isAttacking);const hp=f.log.c._hp;hit();recovery();
    assert.strictEqual(f.log.c._hp,hp);assert(e._isAttacking);base.getHit()();assert(f.log.c._hp<hp);f.nav.destroy();
});
test('AC-STRUCTURE: Boss original building is evaluated by its attack surface, not its occupied center',()=>{
    for(const alternate of [false,true]) {
        const f=fixture({alternate}),building=f.box('building',{xMin:-25,xMax:25,yMin:110,yMax:170},base.classes.Building);
        f.req.target=building.n;f.req.role='boss';
        assert.strictEqual(!!f.nav.blockingLog(f.req,48),!alternate);
        assert(!f.nav._field.pointWalkable(pos(building.n),f.body,f.nav._area));
        f.unit.set(0,80);assert.strictEqual(f.nav.blockingLog(f.req,48),null);
        const e=enemy(f,EnemyBoss);let damage=0;building.c.takeDamage=n=>damage+=n;
        e._upsertTarget(building.n,'building');e._lockedTarget=building.n;e._applyCircleAttack();
        assert.strictEqual(damage,GameConfig.bossBuildingDamage);f.nav.destroy();
    }
});
test('AC-SURFACE: physical rotation/scale/offset envelopes and exact contact epsilon',()=>{
    const f=fixture();
    for(const angle of [0,Math.PI/4,Math.PI/2])for(const sign of [-1,1]) {
        const b=new base.cc.BoxCollider2D();b.size={width:10,height:20};b.offset={x:sign*4,y:sign*3};
        b.node={worldScale:{x:2,y:0.5},worldRotation:{x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)}};
        const body=EnemyNavigation.bodyForCollider(b);assert(body);
        const route=f.nav.logRoute(f.unit,f.log.c,body,32);assert(route);
        assert(f.nav._field.pointWalkable(route.point,body,f.nav._area));
        const unit=f.node('physical',route.point.x,route.point.y);assert(f.nav.canAttackLog(unit,f.log.c,body,32));
    }
    f.unit.set(0,-70);assert(f.nav.canAttackLog(f.unit,f.log.c,f.body,0));
    f.unit.set(0,-69.999);assert(!f.nav.canAttackLog(f.unit,f.log.c,f.body,32));
    f.unit.set(0,-70.001);assert(f.nav.canAttackLog(f.unit,f.log.c,f.body,0.01));f.nav.destroy();
});
for(const Type of [EnemyMinion,EnemyBoss])test(`AC-ATTACK-GENERATION: ${Type.name} old same-life hit/recovery cannot affect next attack`,()=>{
    const f=fixture(),e=enemy(f,Type);advanceToAttack(f,e);const oldHit=base.getHit();
    const recovery=e._scheduled.find(s=>s.delay===(Type===EnemyMinion?0.8:1.2)).cb;
    oldHit();recovery();
    if(e._ai)e._ai.update(5);else e._attackTimer=0;
    e.update(0.01);assert(e._isAttacking);const hp=f.log.c._hp;oldHit();recovery();
    assert.strictEqual(f.log.c._hp,hp);assert(e._isAttacking);base.getHit()();assert(f.log.c._hp<hp);
    f.nav.destroy();
});
function actualEntranceFixture(alternate=false) {
    const geometry=JSON.parse(fs.readFileSync(path.join(evidenceDir,'scene-entrances.json'),'utf8'));
    const f=fixture({body:{width:32.18,height:35.30,offsetX:2.56,offsetY:19.52},
        rect:{xMin:-119.5,xMax:115.5,yMin:1639.397,yMax:1658.397}});
    const marker=p=>f.node('v3-marker',p.x,p.y);
    f.nav.configure({boundsMin:marker(geometry.boundsMin),boundsMax:marker(geometry.boundsMax),
        castlePolygon:geometry.castle.map(marker),walkablePolygon:geometry.ground.map(marker),
        entrances:geometry.entrances.map(e=>({...e,outside:marker(e.outside),inside:marker(e.inside),closePlot:null}))});
    f.nav.setEntranceOpen(1,alternate); f.nav.setEntranceOpen(3,false);
    f.unit.set(0,1900); f.target.set(0,1500); f.nav._prepareFrame();
    return f;
}
test('V3-ROUTE: raw grid connectivity is not a usable entrance route',()=>{
    const f=actualEntranceFixture();
    assert(f.nav._field.canReach(pos(f.unit),pos(f.target),f.body,f.nav._area));
    assert(!f.nav._entranceUsable(f.nav._entrances.get(2),f.body));
    assert.strictEqual(Math.hypot(...Object.values(f.nav.nextVelocity(f.req,new base.cc.Vec2()))),0);
    assert.strictEqual(f.nav.blockingLog(f.req,32)?.log,f.log.c);
    f.nav.destroy();
});
test('V3-UPDATE: actual Minion crosses castle boundary, hits, destroys and resumes',()=>{
    const f=actualEntranceFixture(),e=enemy(f,EnemyMinion); const start=pos(f.unit);
    f.log.c._hp=GameConfig.minionAttackDamage;
    let crossed=false,frames=0;
    while(!e._isAttacking && frames++<3000) {
        step(f,e,0.25);
        if(f.nav.isInside(pos(f.unit))) { crossed=true; assert.strictEqual(e._blockingLog,f.log.c); }
    }
    assert(crossed,'must retain entry obligation after y=1700'); assert(e._isAttacking);
    assert.strictEqual(e._target,f.target); const at=pos(f.unit);
    assert(at.y<1700 && at.y>1560); assert(at.y<start.y);
    base.getHit()(); assert.strictEqual(f.log.c._hp,0);
    e._scheduled.find(s=>s.delay===0.8).cb(); step(f,e,0.25);
    assert.strictEqual(e._blockingLog,null); assert(pos(f.unit).y<at.y);
    f.nav.destroy(); return {frames,crossed,attackPosition:at};
});
test('V3-ALTERNATE: another usable entrance prevents demolition; non-Log seal does not cause it',()=>{
    const f=actualEntranceFixture(true);
    assert.strictEqual(f.nav.blockingLog(f.req,32),null);
    assert(Math.hypot(f.nav.nextVelocity(f.req).x,f.nav.nextVelocity(f.req).y)>0);
    f.nav.setEntranceOpen(1,false);
    f.box('airWall-v3-seal',{xMin:-150,xMax:150,yMin:1580,yMax:1590});
    h.advanceFrame(); assert.strictEqual(f.nav.blockingLog(f.req,32),null); f.nav.destroy();
});
test('V3-VISUAL: prefab Minion approaches from below using physical body despite overlapping Visual',()=>{
    const data=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/prefabs/character/enemy/pref_enemy_minion.prefab'),'utf8'));
    const collider=data.find(c=>c.__type__==='cc.BoxCollider2D'),rootNode=data[collider.node.__id__];
    const visual=data.find(c=>c.__type__==='cc.Node'&&c._name==='Visual');
    const ui=visual._components.map(r=>data[r.__id__]).find(c=>c.__type__==='cc.UITransform');
    const prefab={size:collider._size,offset:collider._offset,scale:rootNode._lscale,
        visualScale:visual._lscale,contentSize:ui._contentSize,anchorPoint:ui._anchorPoint};
    const f=actualEntranceFixture();f.unit.set(0,1500);f.target.set(0,1900);
    const e=enemy(f,EnemyMinion,false,true,prefab); f.body=e._bodySize(); f.req.body=f.body;
    let visualOverlapOutsideRange=false,frames=0;
    while(!e._isAttacking&&frames++<1200) {
        step(f,e,0.25);
        const at=pos(f.unit),gap=f.log.b.worldAABB.yMin-(at.y+f.body.offsetY+f.body.height/2);
        const visualTop=at.y+ui._contentSize.height*e.visualNode.worldScale.y*(1-ui._anchorPoint.y);
        if(visualTop>f.log.b.worldAABB.yMin&&gap>32) {
            visualOverlapOutsideRange=true; assert(e._rb.linearVelocity.y>0,'Visual must not truncate fixed-log approach');
        }
    }
    assert(visualOverlapOutsideRange);assert(e._isAttacking);assert.strictEqual(e._blockingLog,f.log.c);
    assert.strictEqual(e._target,f.target);const hp=f.log.c._hp;base.getHit()();
    assert.strictEqual(f.log.c._hp,hp-GameConfig.minionAttackDamage);
    f.nav.destroy();return {frames,body:f.body,prefab,attackPosition:pos(f.unit)};
});
test('V3-PHASE: same component and coordinates do not share same-side and transition results',()=>{
    const f=actualEntranceFixture();f.unit.set(0,1690);
    assert.strictEqual(f.nav.blockingLog(f.req,32),null);
    const crossing=f.node('crossing',0,1690),req={...f.req,unit:crossing};
    f.nav._unitState.set(crossing,{entranceId:2,phase:'transition',enteringInside:true,fieldId:''});
    const route=f.nav.blockingLog(req,32);assert.strictEqual(route?.log,f.log.c);
    assert.strictEqual(route.entry.enteringInside,true);assert(route.entry.transition);
    assert.strictEqual(f.nav.blockingLog(f.req,32),null);
    f.nav.nextLogVelocity(req,route);assert(f.nav._logEntries.has(crossing));
    f.nav.resetUnit(crossing);assert(!f.nav._logEntries.has(crossing));
    assert.strictEqual(f.nav.blockingLog(req,32),null);f.nav.destroy();
});
test('V3-REVERSE: Boss preserves exit direction and reaches a log hit',()=>{
    const f=actualEntranceFixture();f.unit.set(0,1500);f.target.set(0,1900);
    const e=enemy(f,EnemyBoss);f.nav._unitState.set(f.unit,
        {entranceId:2,phase:'transition',enteringInside:false,fieldId:''});
    const route=f.nav.blockingLog({...f.req,role:'boss'},56);
    assert.strictEqual(route?.entry.enteringInside,false);
    assert(advanceToAttack(f,e)>0);assert.strictEqual(e._blockingLog,f.log.c);
    const hp=f.log.c._hp;base.getHit()();assert.strictEqual(f.log.c._hp,hp-GameConfig.bossAttackDamage);f.nav.destroy();
});
test('V3-OBLIGATION: alternate entrance, changed objective, release and destruction invalidate old entry state',()=>{
    const f=actualEntranceFixture(),e=enemy(f,EnemyMinion);step(f,e,0.25);
    assert(f.nav._logEntries.has(f.unit));f.unit.set(0,1690);
    assert.strictEqual(f.nav.blockingLog(f.req,32)?.log,f.log.c);
    f.nav.setEntranceOpen(1,true);assert.strictEqual(f.nav.blockingLog(f.req,32),null);
    f.nav.setEntranceOpen(1,false);f.target.set(0,1900);
    assert.strictEqual(f.nav.blockingLog(f.req,32)?.entry.enteringInside,false);
    assert(!f.nav._logEntries.has(f.unit));
    f.target.set(0,1500);f.unit.set(0,1900);step(f,e,0.25);assert(f.nav._logEntries.has(f.unit));
    f.nav.releaseUnit(f.unit);assert(!f.nav._logEntries.has(f.unit));
    step(f,e,0.25);f.log.c.takeDamage(GameConfig.logMaxHp);step(f,e,0.25);
    assert.strictEqual(e._blockingLog,null);assert(!f.nav._logEntries.has(f.unit));f.nav.destroy();
});
test('V3-SHARED: actual entrance obstruction reuses queries and graphs for 200 units over 300 frames',()=>{
    const f=actualEntranceFixture(),units=Array.from({length:200},(_,i)=>f.node(`v3-peer-${i}`,0,1900));
    const query=()=>{for(const unit of units)assert.strictEqual(f.nav.blockingLog({...f.req,unit},32)?.log,f.log.c);};
    query();const before={...f.nav.debugStats,graphs:f.nav._field.debugGraphBuildCount,fields:f.nav._field.buildCount};
    for(let i=0;i<300;i++){h.advanceFrame();query();}
    const after={...f.nav.debugStats,graphs:f.nav._field.debugGraphBuildCount,fields:f.nav._field.buildCount};
    for(const key of ['fullSceneScan','blockingScans','surfaceScans','graphs','fields'])assert.strictEqual(after[key],before[key],key);
    assert(f.nav._field.debugEntries<=32);assert(f.nav._field.debugBytes<=8388608);
    f.nav.destroy();return {before,after};
});
fs.writeFileSync(path.join(evidenceDir,'tests.json'),JSON.stringify({results},null,2));
