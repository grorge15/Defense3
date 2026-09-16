const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = path.resolve(__dirname, '../..');
const evidenceDir = path.resolve(root, process.env.NAV_EVIDENCE_DIR ||
    '.cursor/plans/reports/fix-minion-log-route-oscillation-evidence/regression');
const taskDir = path.resolve(root, '.cursor/plans/reports/fix-minion-log-route-oscillation-evidence');
assert(evidenceDir === taskDir || evidenceDir.startsWith(taskDir + path.sep), 'evidence must be task-local');
process.env.NAV_EVIDENCE_DIR = evidenceDir;
// Reuse the read-only demolition harness setup without running its tests or writing its reports.
const harnessPath = path.join(__dirname, 'test-enemy-break-blocking-log.cjs');
const source = fs.readFileSync(harnessPath, 'utf8');
const boundary = source.indexOf("test('AC-SELECTED-ROUTE:");
assert(boundary > 0);
const harness = new Module(harnessPath, module);
harness.filename = harnessPath;
harness.paths = Module._nodeModulePaths(__dirname);
harness._compile(source.slice(0, boundary) + '\nmodule.exports = {h,base,fixture,enemy,pos,settled,blocking,sample,EnemyNavigation,EnemyMinion,GameConfig,Kind,mark,Log};', harnessPath);
const {h,base,fixture,enemy,pos,settled,blocking,sample,EnemyNavigation,EnemyMinion,GameConfig,Kind,mark,Log} = harness.exports;
const results = [], measurements = {};
function test(name, fn) {
    try { results.push({name, passed:true, details:fn()}); console.log(`ok - ${name}`); }
    catch (error) { results.push({name, passed:false, error:String(error.stack)}); console.error(`not ok - ${name}: ${error.message}`); process.exitCode = 1; }
    finally { EnemyNavigation.diagnosticFrame = null; }
}
function openFixture() {
    const f=fixture({logRect:{xMin:-80,xMax:80,yMin:-9.5,yMax:9.5}});
    for(const n of f.scene.children.filter(n=>n.name.startsWith('airWall-'))) n.getComponent(base.cc.BoxCollider2D).enabled=false;
    f.nav.invalidate();return f;
}
function route(f, unit=f.unit, body=f.body) {
    return settled(f, () => f.nav.obstacleRoute(unit, f.log.n, body, 32), 'surface');
}
function commitment(f, unit=f.unit) { return f.nav._obstacleCommitments?.get(unit); }
function tracedUpdate(f,e,dt=1/60) {
    for(const n of [f.unit,f.target,f.log.n]) if(!Object.getOwnPropertyDescriptor(n,'worldPosition')) {
        Object.defineProperty(n,'worldPosition',{get:()=>pos(n)});
    }
    const data={};EnemyNavigation.diagnosticFrame={unit:f.unit,data};
    e._ai?.update(dt);e.update(dt);EnemyNavigation.diagnosticFrame=null;return data;
}
function physicalStep(f,e,dt) {
    const before=pos(f.unit),data=tracedUpdate(f,e,dt),v=e._rb.linearVelocity;
    const after={x:before.x+EnemyNavigation.worldSpeedForPhysicsVelocity(v.x)*dt,
        y:before.y+EnemyNavigation.worldSpeedForPhysicsVelocity(v.y)*dt};
    assert(f.nav._field.lineClear(before,after,f.body,f.nav._area),'actual Minion movement crossed solid geometry');
    f.unit.set(after.x,after.y);h.advanceFrame();sample(f,'physical-step');
    return {distance:Math.hypot(after.x-before.x,after.y-before.y),data};
}

test('AC-REPLAY: observed planning waypoints cannot undo a valid Minion commitment', () => {
    const observedBody={width:38.88,height:38.88,offsetX:2.88,offsetY:19.200000000000003};
    const f=fixture({body:observedBody,logRect:{xMin:-119.5,xMax:115.5,yMin:1632.519,yMax:1651.519}});
    const corners=[[-500,1000],[500,1000],[500,2000],[-500,2000]];
    f.ground.forEach((n,i)=>n.set(...corners[i]));
    f.unit.set(-90.11053466796875,1764.2559814453125);
    f.target.set(73.01343536376953,1336.4056396484375);
    const e=enemy(f,EnemyMinion);
    for(const key of Object.keys(observedBody)) {
        assert(Math.abs(f.body[key]-observedBody[key])<1e-9,`fixture ${key}`);
        assert(Math.abs(e._bodySize()[key]-observedBody[key])<1e-9,`actual collider ${key}`);
    }
    for(const n of [f.unit,f.target,f.log.n]) Object.defineProperty(n,'worldPosition',{get:()=>pos(n)});
    route(f);
    const waypoints=[{x:81.69900000000007,y:1616.367},{x:-8.30099999999993,y:1706.367}];
    let phase=0, resets=0, switches=0, previous=null;
    const direction=f.nav._field.direction.bind(f.nav._field), reset=f.nav.resetUnit.bind(f.nav);
    f.nav._field.direction=(from,to,body,area)=>{
        if(area!==f.nav._planningArea)return direction(from,to,body,area);
        const waypoint=waypoints[phase%2], dx=waypoint.x-from.x,dy=waypoint.y-from.y, length=Math.hypot(dx,dy);
        return {x:dx/length,y:dy/length,waypoint,fieldId:'observed-waypoints',blocked:false,reached:false};
    };
    f.nav.resetUnit=unit=>{resets++;return reset(unit);};
    const branches=[];
    for(phase=0;phase<60;phase++) {
        const data={};EnemyNavigation.diagnosticFrame={unit:f.unit,data};
        e.update(1/60);h.advanceFrame();branches.push(data.branch);
        if(previous!==null && previous!==e._blockingObstacle)switches++;
        previous=e._blockingObstacle;
    }
    measurements.replay={injection:'FlowField.direction, planning area only; fixed observed origin isolates branch logic',
        waypoints,position:pos(f.unit),target:pos(f.target),body:f.body,frames:60,branches,switches,resets};
    f.nav.destroy();
    assert.strictEqual(switches,0,'temporary waypoint changes reversed the committed branch');
    assert.strictEqual(resets,0,'diversion entry/update reset its own commitment');
    assert(branches.every(b=>b==='obstacle-move'));
    return measurements.replay;
});

test('AC-SURFACE: opposite sides in one component choose directly reachable local faces', () => {
    const f=openFixture(),north=f.node('north',0,160),south=f.node('south',0,-160);
    const body={width:38.88,height:38.88,offsetX:2.88,offsetY:19.2};
    const points=[];
    for(const unit of [south,north,south,north]) {
        const r=route(f,unit,body); assert(r);
        points.push(r.point);
        assert(f.nav._field.pointWalkable(r.point,body,f.nav._area));
        assert(f.nav._field.lineClear(pos(unit),r.point,body,f.nav._area),'cached face requires crossing/detouring around the Log');
        assert(Math.sign(r.point.y+body.offsetY)===Math.sign(pos(unit).y));
        assert(Math.abs(r.point.x-pos(unit).x)<=f.nav._field.cellSize/2,'face is not locally nearest');
    }
    f.nav.destroy();return {body,points};
});

test('AC-ATTACK: actual Minion moves safely and damages the Log within a physical frame bound', () => {
    const f=fixture(),e=enemy(f,EnemyMinion),start=pos(f.unit),hp=f.log.c._hp,dt=1/60;
    const speed=EnemyNavigation.worldSpeedForPhysicsVelocity(GameConfig.minionMoveSpeed);
    const maxFrames=128+Math.ceil(800/(speed*dt))+Math.ceil(2/dt);
    let frames=0,pathLength=0,attacks=0;
    for(;frames<maxFrames && f.log.c._hp===hp;frames++) {
        pathLength+=physicalStep(f,e,dt).distance;
        if(e._isAttacking) { assert(f.nav.canAttackObstacle(f.unit,f.log.n,f.body,32));base.getHit()();attacks++; }
    }
    const end=pos(f.unit),net=Math.hypot(end.x-start.x,end.y-start.y);
    const r=commitment(f)?.route;
    const details={frames,maxFrames,dt,speed,attacks,netDisplacement:net,pathLength,damage:hp-f.log.c._hp,
        finalDistanceToApproach:r?Math.hypot(end.x-r.point.x,end.y-r.point.y):null,body:f.body};
    assert(attacks>=1 && f.log.c._hp<hp,'real hit never damaged the Log');
    assert(net>20 && pathLength>=net,'stationary fixture cannot pass');
    assert.strictEqual(hp-f.log.c._hp,GameConfig.minionAttackDamage);
    f.nav.destroy();return details;
});

test('AC-ATTACK-TERMINAL: flow arrival tolerance cannot stop short of attack range', () => {
    const f=fixture(),r=blocking(f);assert(r);
    f.unit.set(r.point.x,r.point.y-3);
    assert(!f.nav.canAttackObstacle(f.unit,f.log.n,f.body,32));
    const flow=f.nav._field.direction(pos(f.unit),r.point,f.body,f.nav._area);
    assert(flow.reached,'fixture must exercise actual flow arrival tolerance');
    const before=pos(f.unit),v=f.nav.nextObstacleVelocity(f.request,r,new base.cc.Vec2());
    assert(v.length()>0,'stopped before attack range');
    const after={x:before.x+v.x*f.request.dt,y:before.y+v.y*f.request.dt};
    assert(f.nav._field.lineClear(before,after,f.body,f.nav._area));f.unit.set(after.x,after.y);
    assert(f.nav.canAttackObstacle(f.unit,f.log.n,f.body,32));
    f.nav.destroy();return {before,after,flowReached:flow.reached};
});

test('AC-SURFACE-FALLBACK: nearest face is screened; shared reachable heuristic takes a safe detour', () => {
    const f=openFixture();
    f.box('airWall-screen',{xMin:-140,xMax:140,yMin:-105,yMax:-80});
    const beforeFields=f.nav._field.buildCount,r=route(f);assert(r);
    assert(f.nav._field.pointWalkable(r.point,f.body,f.nav._area));
    assert(!f.nav._field.lineClear(pos(f.unit),r.point,f.body,f.nav._area),'fixture must require a detour');
    assert.strictEqual(f.nav._field.buildCount,beforeFields,'candidate surface query built a full field');
    let distance=0,frames=0;const start=pos(f.unit);
    for(;frames<600&&!f.nav.canAttackObstacle(f.unit,f.log.n,f.body,32);frames++) {
        const from=pos(f.unit),v=f.nav.nextObstacleVelocity({...f.request,speed:80},r,new base.cc.Vec2());
        const to={x:from.x+v.x*.1,y:from.y+v.y*.1};
        assert(f.nav._field.lineClear(from,to,f.body,f.nav._area));
        distance+=Math.hypot(to.x-from.x,to.y-from.y);f.unit.set(to.x,to.y);sample(f,'fallback');h.advanceFrame();
    }
    assert(f.nav.canAttackObstacle(f.unit,f.log.n,f.body,32),'detour did not reach an attack surface');
    assert(distance>Math.hypot(pos(f.unit).x-start.x,pos(f.unit).y-start.y)+10);
    const details={method:'nearest reachable heuristic, not global shortest physical route',point:r.point,frames,distance,
        movementFields:f.nav._field.buildCount-beforeFields};f.nav.destroy();return details;
});

test('AC-LIFE: route-field release preserves commitment; reset/release isolate unit ownership', () => {
    const f=fixture(),r=blocking(f),peer=f.node('peer',5,-180);assert(r);
    assert(blocking(f,{...f.request,unit:peer}));const own=commitment(f),other=commitment(f,peer);
    f.nav._releaseField(f.unit);assert.strictEqual(commitment(f),own);
    f.nav.nextObstacleVelocity(f.request,r,new base.cc.Vec2());assert.strictEqual(commitment(f),own);
    f.nav.resetUnit(f.unit);assert(!commitment(f));assert.strictEqual(commitment(f,peer),other);
    assert(!f.nav._registeredUnits.has(f.unit));
    assert(blocking(f));f.nav.releaseUnit(f.unit);assert(!commitment(f));assert.strictEqual(commitment(f,peer),other);
    f.nav.releaseUnit(peer);assert.strictEqual(f.nav._obstacleCommitments.size,0);
    f.nav.destroy();assert.strictEqual(f.nav._field.debugBytes,0);
});

test('AC-LIFE: same Player moving directly reachable cancels; real target/body changes reselect', () => {
    const f=fixture();assert(blocking(f));
    f.target.set(60,-160);h.advanceFrame();assert(f.nav._field.lineClear(pos(f.unit),pos(f.target),f.body,f.nav._area));
    assert.strictEqual(blocking(f),null);assert(!commitment(f));
    f.target.set(0,180);h.advanceFrame();assert(blocking(f));
    const target=f.node('replacement-player',10,180),old=commitment(f);
    assert(blocking(f,{...f.request,target}));assert.notStrictEqual(commitment(f),old);
    assert.strictEqual(commitment(f).originalTarget,target);
    const body={width:38.88,height:38.88,offsetX:2.88,offsetY:19.2};
    const previous=commitment(f),changed=blocking(f,{...f.request,target,body});assert(changed);
    assert.notStrictEqual(commitment(f),previous);assert(f.nav._field.pointWalkable(changed.point,body,f.nav._area));
    f.nav.destroy();return {body,point:changed.point};
});

test('AC-LIFE: actual Minion target change, disable, death, reset and destruction release old state', () => {
    const f=fixture(),e=enemy(f,EnemyMinion),peer=f.node('live-peer',5,-180);
    assert(blocking(f,{...f.request,unit:peer}));const other=commitment(f,peer);
    function acquire() { e.setTarget(f.target);e.setForceChaseTarget(true);tracedUpdate(f,e);assert(commitment(f)); }
    acquire();e.setTarget(f.node('other-player',0,200));assert(!commitment(f));
    acquire();e.onDisable();assert(!commitment(f));e.reset();acquire();
    e.takeDamage(999999);assert(!commitment(f));e.reset();acquire();
    f.target.getComponent(base.classes.Player).isDead=true;tracedUpdate(f,e);assert(!commitment(f));
    f.target.getComponent(base.classes.Player).isDead=false;e.reset();acquire();
    e.onDestroy();assert(!commitment(f));assert.strictEqual(commitment(f,peer),other);
    f.nav.destroy();
});

test('AC-LIFE: pending topology and temporary overlap retain decisions but still run physical recovery', () => {
    const f=fixture(),r=blocking(f);assert(r);const original=commitment(f);
    f.box('airWall-distant-change',{xMin:240,xMax:250,yMin:220,yMax:230});h.advanceFrame();
    const reachability=f.nav._field.reachability.bind(f.nav._field);
    f.nav._field.reachability=()=> 'pending';
    assert.strictEqual(f.nav.blockingObstacle(f.request,32),r);assert.strictEqual(commitment(f),original);
    const v=f.nav.nextObstacleVelocity(f.request,r,new base.cc.Vec2()),from=pos(f.unit);
    assert(f.nav._field.lineClear(from,{x:from.x+v.x*.1,y:from.y+v.y*.1},f.body,f.nav._area));
    f.nav._field.reachability=reachability;
    f.unit.set(0,-12);h.advanceFrame();assert(!f.nav._field.pointWalkable(pos(f.unit),f.body,f.nav._area));
    const data={};EnemyNavigation.diagnosticFrame={unit:f.unit,data};
    assert.strictEqual(f.nav.blockingObstacle(f.request,32),r);
    f.nav.nextObstacleVelocity(f.request,r,new base.cc.Vec2());
    assert.strictEqual(data.path,'obstacle-overlap-recovery');assert.strictEqual(commitment(f),original);
    f.nav.destroy();return {pendingRetained:true,overlapPath:data.path};
});

test('AC-LIFE: invalidated geometry, phase, inactive and destroyed obstacles never retain stale references', () => {
    const outcomes=[];
    for(const mode of ['removed','phase','inactive-building','destroyed-building','sealed','approach-blocked']) {
        const f=fixture();
        if(mode.endsWith('building')) {f.log.n.components.delete(Log);f.log.n.addComponent(base.classes.Building);mark(f.log.n,Kind.Destructible);}
        const r=blocking(f);assert(r);const previous=commitment(f);
        if(mode==='removed') {f.log.b.enabled=false;f.nav.invalidate();}
        if(mode==='phase') f.log.c._phase='rolling';
        if(mode==='inactive-building') {f.log.n.active=false;f.log.n.activeInHierarchy=false;f.nav.invalidate();}
        if(mode==='destroyed-building') {f.log.n.isValid=false;f.nav.invalidate();}
        if(mode==='sealed') f.box('airWall-sealed',{xMin:-300,xMax:300,yMin:-110,yMax:-90});
        if(mode==='approach-blocked') f.box('airWall-approach',{xMin:r.point.x-12,xMax:r.point.x+12,yMin:r.point.y-12,yMax:r.point.y+12});
        h.advanceFrame();const next=blocking(f);
        assert.notStrictEqual(commitment(f),previous,mode);
        if(next)assert(f.nav._field.pointWalkable(next.point,f.body,f.nav._area),mode);
        else if(['removed','inactive-building','destroyed-building'].includes(mode)) {
            const velocity=f.nav.nextVelocity(f.request,new base.cc.Vec2());assert(velocity.y>0,`${mode}: pursuit did not resume`);
        }
        if(mode==='phase') {
            assert.strictEqual(next,null);const velocity=f.nav.nextVelocity(f.request,new base.cc.Vec2()),from=pos(f.unit);
            assert(f.nav._field.lineClear(from,{x:from.x+velocity.x*.1,y:from.y+velocity.y*.1},f.body,f.nav._area));
        }
        if(mode==='sealed')assert.strictEqual(next,null);
        outcomes.push({mode,reselected:!!next});f.nav.destroy();
    }
    return outcomes;
});

test('AC-BUDGET: 200 committed units x 300 frames have zero repeated surface/blocker scans', () => {
    const f=openFixture(),units=Array.from({length:200},(_,i)=>f.node(`load-${i}`,i%10-5,i%2?180:-180));
    const targets=[f.target,f.node('south-player',0,-180)];
    const requests=units.map((unit,i)=>({...f.request,unit,target:targets[i%2]}));
    for(const request of requests)assert(blocking(f,request));
    const stats=()=>({...f.nav.debugStats,fields:f.nav._field.buildCount,graphs:f.nav._field.debugGraphBuildCount,
        jobs:{...f.nav._field.debugJobStats},entries:f.nav._field.debugEntries,bytes:f.nav._field.debugBytes});
    const before=stats();let peakWork=0,peakEntries=0,peakBytes=0;
    for(let frame=0;frame<300;frame++) {
        h.advanceFrame();for(const request of requests)assert(f.nav.blockingObstacle(request,32));
        peakWork=Math.max(peakWork,f.nav.debugStats.schedulerLastWork);
        peakEntries=Math.max(peakEntries,f.nav._field.debugEntries);peakBytes=Math.max(peakBytes,f.nav._field.debugBytes);
        sample(f,'commitment-budget');
    }
    const after=stats();
    for(const key of ['surfaceScans','blockingScans','fullSceneScan','fields','graphs'])assert.strictEqual(after[key],before[key],key);
    for(const unit of units)f.nav.releaseUnit(unit);
    assert.strictEqual(f.nav._obstacleCommitments.size,0);assert.strictEqual(f.nav._registeredUnits.size,0);
    const details={units:200,frames:300,before,after,peakWork,peakEntries,peakBytes,releasedCommitments:f.nav._obstacleCommitments.size};
    f.nav.destroy();assert.strictEqual(f.nav._field.debugBytes,0);return details;
});

test('AC-BUDGET-COLD: detour queries share bounded connectivity without per-candidate fields', () => {
    const f=openFixture();f.box('airWall-cold-screen',{xMin:-140,xMax:140,yMin:-105,yMax:-80});
    const units=Array.from({length:200},(_,i)=>f.node(`cold-${i}`,1+i%3,-180));
    let frames=0,ready=0,peakWork=0;
    for(;frames<128 && ready<units.length;frames++) {
        ready=0;h.advanceFrame();
        for(const unit of units)if(f.nav.obstacleRoute(unit,f.log.n,f.body,32))ready++;
        peakWork=Math.max(peakWork,f.nav.debugStats.schedulerLastWork);sample(f,'cold-shared');
    }
    assert.strictEqual(ready,200);assert.strictEqual(f.nav._field.buildCount,0);
    assert.strictEqual(f.nav._field.debugGraphBuildCount,1);assert.strictEqual(f.nav.debugStats.surfaceScans,1);
    const details={frames,ready,peakWork,scans:f.nav.debugStats.surfaceScans,graphs:f.nav._field.debugGraphBuildCount,
        fields:f.nav._field.buildCount,jobs:{...f.nav._field.debugJobStats},entries:f.nav._field.debugEntries,bytes:f.nav._field.debugBytes};
    f.nav.destroy();return details;
});

fs.mkdirSync(evidenceDir,{recursive:true});
fs.writeFileSync(path.join(evidenceDir,'tests.json'),JSON.stringify({results,measurements},null,2));
