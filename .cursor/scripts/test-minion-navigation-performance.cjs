const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const root = path.resolve(__dirname, '../..');
const evidence = path.resolve(root, process.env.NAV_EVIDENCE_DIR ||
    '.cursor/plans/reports/minion-navigation-performance-evidence/runtime');
assert(evidence.startsWith(path.join(root, '.cursor/plans/reports/minion-navigation-performance-evidence') + path.sep));
const filename = path.join(__dirname, 'test-enemy-break-blocking-log.cjs');
const source = fs.readFileSync(filename, 'utf8');
const harness = new Module(filename, module);
harness.filename = filename;
harness.paths = Module._nodeModulePaths(__dirname);
harness._compile(source.slice(0, source.indexOf("test('AC-SELECTED-ROUTE:")) +
    '\nmodule.exports={h,base,fixture,enemy,pos,EnemyMinion,EnemyBoss,EnemyNavigation,GameConfig,Kind,mark};', filename);
const {h,base,fixture,enemy,pos,EnemyMinion,EnemyBoss,EnemyNavigation,GameConfig,Kind,mark} = harness.exports;
const hashes = Object.fromEntries(['enemy/EnemyMinion','core/EnemyNavigation','core/FlowField','core/GameConfig'].map(name =>
    [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, `assets/scripts/${name}.ts`))).digest('hex')]));
function measure(kind, count = 50, hz = 60, seconds = 3) {
    const f = fixture(), units = [], dt = 1 / hz;
    if (kind === 'tracking' || kind === 'dense') { f.log.b.enabled = false; f.nav.invalidate(); }
    for (let i = 0; i < count; i++) {
        const unit = i ? f.node(`minion-${i}`, (i % 10 - 5) * (kind === 'dense' ? 2 : 12), -180 - Math.floor(i / 10) * 3) : f.unit;
        units.push(enemy({...f, unit}, EnemyMinion));
    }
    let decisions = 0, avoidance = 0, progress = 0;
    const block = f.nav.blockingObstacle.bind(f.nav), avoid = f.nav._applyLocalAvoidance.bind(f.nav);
    f.nav.blockingObstacle = (...args) => { decisions++; return block(...args); };
    f.nav._applyLocalAvoidance = (...args) => { avoidance++; return avoid(...args); };
    const frames = [];
    for (let frame = 0; frame < hz * seconds; frame++) {
        if (frame === hz && kind === 'destroy') { f.log.b.enabled = false; f.log.c._hp = 0; f.nav.invalidate(); }
        if (frame === hz && kind === 'wall') f.box('new-wall', {xMin:-90,xMax:90,yMin:-110,yMax:-90}, null, Kind.Hard);
        const before = decisions, start = performance.now();
        for (const e of units) {
            const p = pos(e.node); e.update(dt);
            const v = e._rb.linearVelocity;
            const next = {x:p.x + v.x * 32 * dt, y:p.y + v.y * 32 * dt};
            assert(!f.nav._field.pointWalkable(p, e._bodySize(), f.nav._area) ||
                f.nav._field.lineClear(p, next, e._bodySize(), f.nav._area),
                `physical sweep failed: ${kind}/${frame}/${e.node.name} ${JSON.stringify({p,next})}`);
            progress += Math.hypot(next.x-p.x, next.y-p.y); e.node.set(next.x, next.y);
        }
        frames.push({frame, ms:performance.now()-start, decisions:decisions-before,
            work:f.nav.debugStats.schedulerLastWork, bytes:f.nav._field.debugBytes, entries:f.nav._field.debugEntries});
        h.advanceFrame();
    }
    const sorted = frames.map(f=>f.ms).sort((a,b)=>a-b);
    const result = {kind,count,hz,seconds,decisions,avoidance,progress,stats:{...f.nav.debugStats},
        jobs:{...f.nav._field.debugJobStats}, fields:f.nav._field.buildCount, graphs:f.nav._field.debugGraphBuildCount,
        median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),frames};
    f.nav.destroy(); return result;
}
const measurements = ['tracking','dense','demolition','destroy','wall'].map(kind=>measure(kind));
const checks = [];
function test(name, run) {
    try { const details=run(); checks.push({name,passed:true,details}); console.log(`ok - ${name}`); }
    catch(error) { checks.push({name,passed:false,error:String(error.stack)}); process.exitCode=1; console.error(`not ok - ${name}: ${error.message}`); }
}
if (!process.argv.includes('--measure-only')) {
    test('cadence, first-frame staggering, continuous integration and long-frame no catch-up',()=>{
        const rows=[];
        for(const [count,hz] of [[50,30],[50,60],[200,120]]) {
            const f=fixture(), units=[],counts=new Map(),first=new Map(),avoidFirst=new Map();
            for(const c of f.scene.children) { const b=c.getComponent(base.cc.BoxCollider2D); if(b)b.enabled=false; }
            f.ground.forEach((n,i)=>n.set(...[[-20000,-5000],[20000,-5000],[20000,5000],[-20000,5000]][i]));
            f.target.set(0,4000);f.nav.invalidate();
            for(let i=0;i<count;i++) {
                const unit=f.node(`cadence-${i}`,i*80,-1000),target=f.node(`target-${i}`,i*80,4000);
                target.addComponent(base.classes.Player);units.push(enemy({...f,unit},EnemyMinion,{target}));
            }
            let frame=0;
            const block=f.nav.blockingObstacle.bind(f.nav),avoid=f.nav._applyLocalAvoidance.bind(f.nav);
            f.nav.blockingObstacle=(r,...rest)=>{counts.set(r.unit,(counts.get(r.unit)||0)+1);if(!first.has(r.unit))first.set(r.unit,frame);return block(r,...rest);};
            f.nav._applyLocalAvoidance=(unit,...args)=>{if(!avoidFirst.has(unit))avoidFirst.set(unit,frame);return avoid(unit,...args);};
            // Independent lanes isolate speed integration while all navigation methods remain real.
            const start=pos(units[0].node),dt=1/hz;
            for(;frame<hz*10;frame++) {
                for(const e of units){e.update(dt);const p=pos(e.node),v=e._rb.linearVelocity;e.node.set(p.x+v.x*32*dt,p.y+v.y*32*dt);}
                h.advanceFrame();
            }
            assert(Math.max(...counts.values())<=41);
            assert(new Set(first.values()).size>1);assert(new Set(avoidFirst.values()).size>1);
            assert(f.nav.debugStats.minionAvoidanceMaxUsed<=4);
            const expected=GameConfig.minionMoveSpeed*32*10;
            const error=Math.abs(pos(units[0].node).y-start.y-expected);assert(error<1e-6,`integration error ${error}`);
            const before=new Map(counts);for(const e of units)e.update(1.2);
            for(const e of units)assert((counts.get(e.node)||0)-(before.get(e.node)||0)<=1);
            rows.push({count,hz,maxDecisions:Math.max(...before.values()),firstDecisionFrames:new Set(first.values()).size,
                firstAvoidanceFrames:new Set(avoidFirst.values()).size,integrationError:error});
            f.nav.destroy();assert.strictEqual(f.nav._minionAvoidance.size,0);
        }
        return rows;
    });
    test('immediate target death, body change, knockback, disable and current-geometry sweep',()=>{
        const f=fixture(),e=enemy(f,EnemyMinion);f.log.b.enabled=false;f.nav.invalidate();
        e.update(.3);assert(e._rb.linearVelocity.y>0);
        e._decisionRemaining=.2;f.target.getComponent(base.classes.Player).isDead=true;e.update(1/60);
        assert.strictEqual(e._rb.linearVelocity.length(),0);assert.strictEqual(e._navigationKey,'');
        assert(!f.nav._minionAvoidance.has(f.unit));
        f.target.getComponent(base.classes.Player).isDead=false;e.update(.3);
        const oldKey=e._navigationKey,collider=e.node.getComponent(base.cc.CircleCollider2D) ?? e.node.getComponent(base.cc.BoxCollider2D);
        if(collider.radius)collider.radius+=1;else collider.size.width+=1;
        e.update(1/60);assert.notStrictEqual(e._navigationKey,oldKey);
        e._decisionRemaining=.2;
        const p=pos(f.unit),body=e._bodySize(),edge=p.y+(body.offsetY??0)+body.height/2+.5;
        f.box('immediate-wall',{xMin:-100,xMax:100,yMin:edge,yMax:edge+5},null,Kind.Hard);
        e.update(1/60);const v=e._rb.linearVelocity;
        assert(f.nav._field.lineClear(p,{x:p.x+v.x*32/60,y:p.y+v.y*32/60},body,f.nav._area));
        assert(e.applyBuildingSpawnKnockback(new base.cc.Vec2(1,0)));assert.strictEqual(e._navigationKey,'');
        e.update(1/60);assert(e._rb.linearVelocity.x>0);assert.strictEqual(e._rb.linearVelocity.y,0);
        e.onDisable();assert.strictEqual(e._navigationKey,'');assert(!f.nav._minionAvoidance.has(f.unit));f.nav.destroy();
    });
    test('soft deadline yields, work caps hold, cancelled jobs cannot publish and mixed requests settle',()=>{
        const f=fixture();mark(f.log.n,Kind.Hard);
        f.nav.geometryVersion;
        const flow=f.nav._field;
        flow.direction(pos(f.unit),pos(f.target),f.body,f.nav._area);
        assert(flow.debugPendingJobs>0);
        const used=flow.advanceJobs(4096,0);assert(used>0&&used<=32);assert(flow.debugJobStats.deadlineStops>0);
        const cancelled=flow.debugJobStats.cancelled;f.nav.invalidate();f.log.b.enabled=false;f.nav.geometryVersion;
        assert(flow.debugJobStats.cancelled>cancelled);assert.strictEqual(flow.debugPendingJobs,0);
        f.log.b.enabled=true;f.nav.invalidate();
        let frames=0;
        for(;frames<256;frames++) {
            h.advanceFrame();const workBefore=flow.debugJobStats.totalWork;
            for(const role of ['minion','boss'])f.nav.nextVelocity({...f.request,role,body:{width:role==='boss'?40:10,height:20}},new base.cc.Vec2());
            assert(flow.debugJobStats.totalWork-workBefore<=4096);
            assert(f.nav.debugStats.schedulerLastWork<=4096);assert(flow.debugEntries<=32);assert(flow.debugBytes<=8388608);
            if(!flow.debugPendingJobs)break;
        }
        assert(frames<256);const result={frames,used,jobs:{...flow.debugJobStats},peakBytes:flow.debugStats.peakBytes};
        f.nav.destroy();assert.strictEqual(flow.debugBytes,0);return result;
    });
}
fs.mkdirSync(evidence, {recursive:true});
fs.writeFileSync(path.join(evidence,'measurements.json'), JSON.stringify({hashes,measurements,checks},null,2));
console.log(JSON.stringify(measurements.map(({kind,decisions,avoidance,progress,median,p95,max})=>
    ({kind,decisions,avoidance,progress,median,p95,max})),null,2));
