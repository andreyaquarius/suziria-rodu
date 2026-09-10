(function(root){
  'use strict';
  const nodeId = (kind, id) => `${kind}_${id}`;
  const norm = text => String(text || '').normalize('NFKC').toLocaleLowerCase('uk');
  const idOf = value => typeof value === 'object' ? value.id : value;
  function filterVideos(data, {search='', category='all', channel='all',videoIds=null}={}) {
    const topics = new Map(data.topics.map(t => [t.id,t]));
    const channels = new Map(data.channels.map(c => [c.id,c.title]));
    const people = new Map(data.people.map(p => [p.id,p.name]));
    const term = norm(search.trim());
    return data.videos.filter(v => (!videoIds||videoIds.has(v.id)) && (channel === 'all' || String(v.channel_id) === String(channel)) && (category === 'all' || v.topics.some(id => topics.get(id)?.category === category)) && (!term || norm([v.title, channels.get(v.channel_id), ...v.topics.map(id => topics.get(id)?.name), ...v.people.map(id => people.get(id))].join(' ')).includes(term)));
  }
  function buildGraph(data, videos, {
    mode='channel_overlap',
    minWeight=1,
    maxNodes=Infinity,
    maxEdges=Infinity,
    category='all', channel='all'
  }={}) {
    // Every mode includes all matching relationships by default. Selecting a
    // channel only narrows the map, never reveals silently dropped records.
    // Explicit budgets remain available to callers, but the site uses none.
    // Channel-overlap needs sources from both sides; other modes stay within
    // the selected channel. Apply the overlap filter before ranking/truncation.
    const selectedChannel=channel==='all'?null:nodeId('channel',channel);
    const crossChannel=['channel_overlap','channel_connections'].includes(mode);
    if(selectedChannel&&!crossChannel)videos=videos.filter(v=>String(v.channel_id)===String(channel));
    const categoryTopics=new Set(data.topics.filter(t=>category==='all'||t.category===category).map(t=>t.id));
    const labels = new Map([...data.channels.map(c=>[nodeId('channel',c.id),c.title]), ...data.people.map(p=>[nodeId('person',p.id),p.name]), ...data.topics.map(t=>[nodeId('topic',t.id),t.name])]);
    const thumbnails = new Map(data.channels.filter(c=>c.thumbnail).map(c=>[nodeId('channel',c.id),c.thumbnail]));
    const nodes = new Map(), links = new Map(), topicEntities = new Map(), personChannels = new Map();
    function addNode(id, video) { if (!nodes.has(id)) nodes.set(id,{id,type:id.split('_')[0],label:labels.get(id)||id,...(thumbnails.has(id)?{thumbnail:thumbnails.get(id)}:{}),videos:new Set()}); if(video)nodes.get(id).videos.add(video.id); }
    function addLink(a,b,ids,topics=[],relation='together') {
      const [source,target]=[a,b].sort(), key=`${source}:${target}`;
      if(!links.has(key)) links.set(key,{id:key,source,target,relation,videos:new Set(),topics:new Set()});
      const link=links.get(key); ids.forEach(id=>link.videos.add(id)); topics.forEach(id=>link.topics.add(id));
      return link;
    }
    function pairs(items, fn){for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++)fn(items[a],items[b]);}
    for (const v of videos) {
      const relevantTopics=v.topics.filter(id=>categoryTopics.has(id));
      if(mode==='channel_connections'&&category!=='all'&&!relevantTopics.length)continue;
      const c=nodeId('channel',v.channel_id), ps=v.people.map(id=>nodeId('person',id)), ts=relevantTopics.map(id=>nodeId('topic',id));
      if(mode.startsWith('channel')) addNode(c,v);
      if(['people','people_topics','person_topic','channel_person'].includes(mode)) ps.forEach(id=>addNode(id,v));
      if(['channel_topic','person_topic','topic_topic'].includes(mode)) ts.forEach(id=>addNode(id,v));
      if(['channel_overlap','people_topics'].includes(mode)) relevantTopics.forEach(t=>{if(!topicEntities.has(t))topicEntities.set(t,new Map());const group=topicEntities.get(t);for(const entity of mode==='channel_overlap'?[c]:ps){if(!group.has(entity))group.set(entity,new Set());group.get(entity).add(v.id);}});
      if(mode==='channel_topic') ts.forEach(t=>addLink(c,t,[v.id],[Number(t.split('_')[1])]));
      if(mode==='channel_person') ps.forEach(p=>addLink(c,p,[v.id],relevantTopics));
      if(mode==='channel_connections') for(const person of new Set(v.people)){
        if(!personChannels.has(person))personChannels.set(person,new Map());
        const channels=personChannels.get(person);
        if(!channels.has(c))channels.set(c,new Set());
        channels.get(c).add(v.id);
      }
      if(mode==='person_topic') ps.forEach(p=>ts.forEach(t=>addLink(p,t,[v.id],[Number(t.split('_')[1])])));
      if(mode==='people') pairs(ps,(a,b)=>addLink(a,b,[v.id],relevantTopics));
      if(mode==='topic_topic') pairs(ts,(a,b)=>addLink(a,b,[v.id],[Number(a.split('_')[1]),Number(b.split('_')[1])]));
    }
    if(mode==='channel_person')for(const channel of data.channels){
      const c=nodeId('channel',channel.id);if(!nodes.has(c))continue;
      for(const author of channel.authors||[]){
        const p=nodeId('person',author.person_id);labels.set(p,author.name);addNode(p);
        const link=addLink(c,p,[]);link.relation='channel_author';link.authorship=true;
      }
    }
    for(const [topic,entities] of topicEntities) pairs([...entities.keys()],(a,b)=>addLink(a,b,[...entities.get(a),...entities.get(b)],[topic],'shared_topics'));
    // v.people contains admitted participant IDs, never mention-only relations.
    // Repeated appearances add evidence, not extra people to the edge weight.
    for(const [person,channels] of personChannels) pairs([...channels.keys()],(a,b)=>{
      const link=addLink(a,b,[...channels.get(a),...channels.get(b)],[],'shared_people');
      (link.people??=new Set()).add(person);
    });
    const ranked=[...links.values()].map(l=>({...l,weight:l.relation==='channel_author'?Math.max(1,l.videos.size):l.relation==='shared_people'?l.people.size:l.relation==='shared_topics'?l.topics.size:l.videos.size,videos:[...l.videos],topics:[...l.topics],...(l.people?{people:[...l.people].sort((a,b)=>a-b)}:{})})).filter(l=>l.weight>=minWeight&&(!selectedChannel||!crossChannel||l.source===selectedChannel||l.target===selectedChannel)).sort((a,b)=>b.weight-a.weight||a.id.localeCompare(b.id));
    const scores=new Map();ranked.forEach(l=>[l.source,l.target].forEach(id=>scores.set(id,(scores.get(id)||0)+l.weight)));
    const selected=new Set([...scores].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,maxNodes).map(([id])=>id));
    const finalLinks=ranked.filter(l=>selected.has(l.source)&&selected.has(l.target)).slice(0,maxEdges);
    const connected=new Set(finalLinks.flatMap(l=>[l.source,l.target]));
    return {nodes:[...nodes.values()].filter(n=>connected.has(n.id)).map(n=>({...n,videos:[...n.videos],weight:scores.get(n.id)||1})),links:finalLinks,totalLinks:ranked.length,truncated:ranked.length>finalLinks.length};
  }
  function evidenceVideos(data, selection, videos=data.videos, topic=null, person=null) {
    if(topic!=null&&selection.relation==='shared_topics'&&!selection.topics.includes(Number(topic)))return [];
    const ids=new Set(selection.videos || []);
    const people=selection.relation==='shared_people'?(selection.people||[]).filter(id=>person==null||id===Number(person)):null;
    return videos.filter(v=>ids.has(v.id) && (topic==null||v.topics.includes(Number(topic))) && (!people||v.people.some(id=>people.includes(id))));
  }
  function evidenceFor(video, selection={}, topic=null, person=null) {
    let ids;
    if(selection.relation==='shared_people')ids=(selection.people||[]).filter(id=>video.people.includes(id)&&(person==null||id===Number(person))).map(id=>nodeId('person',id));
    else if(topic!=null)ids=[nodeId('topic',Number(topic))];
    else if(selection.relation==='shared_topics')ids=(selection.topics||[]).map(id=>nodeId('topic',id));
    else if(/^(person|topic)_\d+$/.test(selection.id||''))ids=[selection.id];
    else ids=[idOf(selection.source||''),idOf(selection.target||'')].filter(id=>/^(person|topic)_\d+$/.test(id));
    // Never substitute an unrelated quotation when the selected relationship has none.
    return (video.evidence||[]).find(e=>ids.includes(e.id))||null;
  }
  function evidenceGroups(data, selection, videos=data.videos, topic=null, person=null) {
    const matches=evidenceVideos(data,selection,videos,topic,person);
    if(!['shared_topics','shared_people'].includes(selection.relation))return [{label:null,videos:matches}];
    return [selection.source,selection.target].map(endpoint=>{
      const id=idOf(endpoint),[kind,raw]=id.split('_'),number=Number(raw);
      const entity=(kind==='channel'?data.channels:data.people).find(item=>item.id===number);
      return {id,label:entity?.title||entity?.name||id,videos:matches.filter(v=>kind==='channel'?v.channel_id===number:v.people.includes(number))};
    });
  }
  function buildRating(data) {
    if(!['thematic-v3','thematic-v4','thematic-v5'].includes(data.rating_policy?.version))return [];
    const stats=new Map(data.channels.map((c,order)=>[c.id,{...c,order,people:new Set(),topics:new Set(),pairs:new Set(),videos:[]}])) , personChannels=new Map(), topicChannels=new Map();
    for(const v of data.videos){
      const channel=stats.get(v.channel_id);if(!channel)continue;channel.videos.push(v.id);
      const people=[...new Set(v.people)].sort((a,b)=>a-b);
      for(const p of people){channel.people.add(p);if(!personChannels.has(p))personChannels.set(p,new Set());personChannels.get(p).add(v.channel_id);}
      for(const t of v.topics){channel.topics.add(t);if(!topicChannels.has(t))topicChannels.set(t,new Set());topicChannels.get(t).add(v.channel_id);}
      for(let a=0;a<people.length;a++)for(let b=a+1;b<people.length;b++)channel.pairs.add(`${people[a]}:${people[b]}`);
    }
    return [...stats.values()].filter(c=>c.videos.length&&c.rating?.rating_version===data.rating_policy.version).map(c=>{
      const shared=[...c.topics].filter(t=>topicChannels.get(t).size>1),related=new Set(shared.flatMap(t=>[...topicChannels.get(t)]));related.delete(c.id);
      const cross=[...c.people].filter(p=>personChannels.get(p).size>1).length;
      return {id:c.id,title:c.title,thumbnail:c.thumbnail,url:c.url,videos:c.videos,order:c.order,entity_type:'channel',unique_people:c.people.size,cross_channel_people:cross,coappearance_edges:c.pairs.size,shared_topics:shared.length,related_channels:related.size,...c.rating};
    }).sort((a,b)=>b.score-a.score||a.order-b.order).map((c,index)=>({...c,rank:index+1}));
  }
  const ratingSubjects=Object.freeze({all:'Усі',genealogy:'Генеалогічні',local_history:'Краєзнавчі',history:'Історичні'});
  function ratingSubjectVideos(data,channelId,subject='all'){
    if(!Object.hasOwn(ratingSubjects,subject))return [];
    // Match the server's substantive subjects, not incidental context shares.
    // The old non-zero-share rule is only for still-cached v3 releases.
    // Rating counters describe the entire channel, independently of search.
    return data.videos.filter(v=>v.channel_id===Number(channelId)&&(subject==='all'||(Array.isArray(v.rating?.main_subjects)?v.rating.main_subjects.includes(subject):data.rating_policy?.version&&data.rating_policy.version!=='thematic-v3'?false:Number(v.rating?.subjects?.[subject])>0)));
  }
  function buildPeopleRating(data,{topic='all'}={}){
    if(!['thematic-v3','thematic-v4','thematic-v5'].includes(data.rating_policy?.version))return [];
    return data.people.map((person,order)=>{
      const rating=topic==='all'?person.rating:person.rating_topics?.find(r=>r.topic_id===Number(topic));
      if(!rating||rating.rating_version!==data.rating_policy.version)return null;
      return {id:person.id,title:person.name,entity_type:'person',order,...rating,
        videos:rating.video_ids,appearance_count:person.appearance_count,channel_count:person.channel_count,
        unassigned_count:person.unassigned_count,top_topics:[...(person.rating_topics||[])].sort((a,b)=>b.score-a.score).slice(0,5)};
    }).filter(Boolean).sort((a,b)=>b.score-a.score||a.order-b.order).map((p,index)=>({...p,rank:index+1}));
  }
  function neighborhood(graph,id){
    const nodes=new Set([id]),links=[];
    for(const link of graph.links){const a=idOf(link.source),b=idOf(link.target);if(a===id||b===id){nodes.add(a);nodes.add(b);links.push(link.id);}}
    return {nodes:[...nodes],links};
  }
  function layoutAdaptiveGraphLabels(items,{width,height,zoom=1,focused=false,margin=8},obstacles=[]){
    if(!(width>2*margin&&height>2*margin))return [];
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    const intersects=(a,b,gap=7)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
    const visible=items.filter(p=>[p.x,p.y,p.width,p.height].every(Number.isFinite)&&p.width>0&&p.height>0&&p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height);
    const budget=clamp(Math.round(clamp(Math.floor(width*height/90000),4,18)*clamp(Number.isFinite(zoom)?zoom:1,.7,2)),4,32);
    const priority=p=>(Number(p.priority)||0)+(p.previous?.id===p.id?1:0);
    const ordered=visible.filter(p=>!focused||p.related||p.pinned).sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||priority(b)-priority(a)||String(a.id).localeCompare(String(b.id)));
    const nodeBoxes=visible.map(p=>{const r=clamp(p.radius||10,5,35);return {x:p.x-r,y:p.y-r,width:r*2,height:r*2};});
    const placed=[];
    for(const item of ordered){
      if(placed.length>=budget&&!item.pinned)continue;
      const w=Math.min(item.width,width-2*margin),h=Math.min(item.height,height-2*margin),r=Math.max(10,item.radius||10)+9;
      const candidates=[];
      if(item.previous){const p=item.previous;candidates.push([p.x+item.x-p.anchorX,p.y+item.y-p.anchorY]);}
      candidates.push([item.x-w/2,item.y+r],[item.x-w/2,item.y-h-r],[item.x+r,item.y-h/2],[item.x-w-r,item.y-h/2],
        [item.x+r,item.y+r],[item.x-w-r,item.y+r],[item.x+r,item.y-h-r],[item.x-w-r,item.y-h-r]);
      let best=null;
      for(const [x,y] of candidates){
        const rect={x:clamp(x,margin,width-margin-w),y:clamp(y,margin,height-margin-h),width:w,height:h};
        const endX=clamp(item.x,rect.x,rect.x+w),endY=clamp(item.y,rect.y,rect.y+h);
        // Automatic names stay beside their own nodes, never in a distant wall of labels.
        if(Math.hypot(item.x-endX,item.y-endY)>r+38)continue;
        if(placed.some(p=>intersects(rect,p))||obstacles.some(p=>intersects(rect,p))||nodeBoxes.some(p=>intersects(rect,p,3)))continue;
        best={...rect,id:item.id,anchorX:item.x,anchorY:item.y,endX,endY};break;
      }
      // Keep the main hub and any selected/keyboard-focused node identifiable,
      // allowing a longer leader only for these anchors of the map.
      if(!best&&(item.pinned||(!focused&&item===ordered[0])))best=layoutGraphLabels([item],{width,height,margin,relax:false},[...obstacles,...placed,...nodeBoxes])[0];
      if(best)placed.push(best);
    }
    return placed;
  }
  function layoutGraphLabels(items,{width,height,margin=8,relax=true},obstacles=[]){
    if(!(width>2*margin&&height>2*margin))return [];
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)+5)*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)+5);
    const visible=items.filter(item=>[item.x,item.y,item.width,item.height].every(Number.isFinite)&&item.width>0&&item.height>0&&item.x>=-24&&item.x<=width+24&&item.y>=-24&&item.y<=height+24);
    const nodes=visible.map(item=>({x:item.x-8,y:item.y-8,width:16,height:16}));
    const placed=[];
    for(const item of visible){
      const w=Math.min(item.width,width-2*margin),h=Math.min(item.height,height-2*margin);
      const preferred={x:item.x-w/2,y:item.y+16};
      let best=null,bestCollision=Infinity,bestDistance=Infinity,found=false;
      const consider=(x,y)=>{
        const rect={x:clamp(x,margin,width-margin-w),y:clamp(y,margin,height-margin-h),width:w,height:h};
        let collision=0;
        for(const other of placed)collision+=overlap(rect,other);
        for(const obstacle of obstacles)collision+=overlap(rect,obstacle)*4;
        for(const node of nodes)collision+=overlap(rect,node);
        const distance=(rect.x-preferred.x)**2+(rect.y-preferred.y)**2;
        if(collision<bestCollision||(collision===bestCollision&&distance<bestDistance)){best=rect;bestCollision=collision;bestDistance=distance;}
        return collision===0;
      };
      // Keep the previous offset while the graph moves, and ease it back toward
      // its node when space becomes free. Never hide a label to avoid a collision.
      if(item.previous){
        const p=item.previous,x=p.x+item.x-p.anchorX,y=p.y+item.y-p.anchorY;
        found=(relax&&consider(x+(preferred.x-x)*.12,y+(preferred.y-y)*.12))||consider(x,y);
      }
      if(!found)found=consider(preferred.x,preferred.y)||consider(preferred.x,item.y-h-16)||consider(item.x+16,item.y-h/2)||consider(item.x-w-16,item.y-h/2);
      for(let row=1;row<=10&&!found;row++){
        for(const y of [preferred.y+row*(h+6),item.y-h-16-row*(h+6)]){
          for(const x of [preferred.x,item.x+16,item.x-w-16]){
            if(consider(x,y)){found=true;break;}
          }
          if(found)break;
        }
      }
      if(!found){
        // Look in free horizontal intervals, including narrow gaps a coarse
        // grid would miss. The viewport and rectangle edges bound the search.
        const blockers=[...placed,...obstacles,...nodes],right=width-margin;
        const rows=[margin,height-margin-h,clamp(preferred.y,margin,height-margin-h),...blockers.flatMap(b=>[b.y+b.height+6,b.y-h-6])]
          .filter(y=>y>=margin&&y<=height-margin-h).sort((a,b)=>Math.abs(a-preferred.y)-Math.abs(b-preferred.y));
        for(const y of new Set(rows)){
          if(bestCollision===0&&(y-preferred.y)**2>bestDistance)break;
          const intervals=blockers.filter(b=>y+h+5>b.y&&b.y+b.height+5>y).map(b=>[b.x-6,b.x+b.width+6]).sort((a,b)=>a[0]-b[0]);
          let left=margin;
          for(const [start,end] of intervals){
            if(Math.min(start,right)-left>=w)consider(clamp(preferred.x,left,Math.min(start,right)-w),y);
            left=Math.max(left,end);if(left>=right)break;
          }
          if(right-left>=w)consider(clamp(preferred.x,left,right-w),y);
        }
        // If a small screen genuinely cannot fit every box, retain the least
        // overlapping placement and its pointer instead of omitting the name.
      }
      placed.push({...best,id:item.id,anchorX:item.x,anchorY:item.y,
        endX:clamp(item.x,best.x,best.x+w),endY:clamp(item.y,best.y,best.y+h)});
    }
    return placed;
  }
  // Match the research graph's spring response. The simulation settles to save
  // work, but every deliberate drag wakes it and moves the connected nodes.
  function orbitStep(position,target,phase,seconds,speed=.045){
    const dx=position.x-target.x,dz=position.z-target.z;
    const radius=Math.hypot(dx,position.y-target.y,dz),angle=seconds*speed;
    const nextPhase=phase+seconds;
    // Translate camera AND look-at point for a bounded vertical float, while
    // orbiting around the current focus. Never move data or manufacture links.
    const float=(Math.sin(nextPhase*.4)-Math.sin(phase*.4))*radius*.018;
    return {phase:nextPhase,target:{x:target.x,y:target.y+float,z:target.z},position:{
      x:target.x+dx*Math.cos(angle)+dz*Math.sin(angle),
      y:position.y+float,z:target.z+dz*Math.cos(angle)-dx*Math.sin(angle),
    }};
  }
  const magnitude=v=>Math.hypot(v.x,v.y,v.z);
  function flingVelocity(previous,next,seconds){
    if(seconds<=0)return null;
    const eye=view=>({x:view.position.x-view.target.x,y:view.position.y-view.target.y,z:view.position.z-view.target.z});
    const a=eye(previous),b=eye(next),length=magnitude(a)*magnitude(b);
    if(!length)return null;
    const axis={x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x};
    const cross=magnitude(axis),angle=Math.atan2(cross,a.x*b.x+a.y*b.y+a.z*b.z);
    // Pan and zoom do not impart angular momentum. Cap a very fast fling.
    if(cross/length<1e-7)return null;
    const scale=Math.min(2.4,angle/seconds)/cross;
    return {x:axis.x*scale,y:axis.y*scale,z:axis.z*scale};
  }
  function spinStep(position,target,up,velocity,seconds){
    const speed=magnitude(velocity),decay=Math.exp(-.45*seconds);
    if(!speed)return {position,up,velocity};
    const axis={x:velocity.x/speed,y:velocity.y/speed,z:velocity.z/speed};
    // Integrate exponential damping exactly, independent of display frame rate.
    const angle=speed*(1-decay)/.45,c=Math.cos(angle),s=Math.sin(angle);
    const rotate=v=>{const dot=axis.x*v.x+axis.y*v.y+axis.z*v.z;return {
      x:v.x*c+(axis.y*v.z-axis.z*v.y)*s+axis.x*dot*(1-c),
      y:v.y*c+(axis.z*v.x-axis.x*v.z)*s+axis.y*dot*(1-c),
      z:v.z*c+(axis.x*v.y-axis.y*v.x)*s+axis.z*dot*(1-c),
    };};
    const eye=rotate({x:position.x-target.x,y:position.y-target.y,z:position.z-target.z});
    return {position:{x:target.x+eye.x,y:target.y+eye.y,z:target.z+eye.z},up:rotate(up),
      velocity:{x:velocity.x*decay,y:velocity.y*decay,z:velocity.z*decay}};
  }
  function createGraphDynamics(graph,{onDragStart=()=>{},onDragEnd=()=>{},onNavigateStart=()=>{},now=()=>performance.now(),requestFrame=root.requestAnimationFrame?.bind(root),cancelFrame=root.cancelAnimationFrame?.bind(root)}={}){
    let paused=false,visible=true,dragging=false,navigating=false,clickAfter=0;
    let frame=0,lastTick=null,phase=0,idleUntil=now()+1800,spin=null,gesture=null;
    const controls=graph.controls();
    const originalStaticMoving=controls.staticMoving;
    // Own the coast so it is time-based, pausable and separate from node physics.
    controls.staticMoving=true;
    const readView=()=>{
      const position=graph.cameraPosition(),target=controls.target,up=controls.object?.up||{x:0,y:1,z:0};
      if(!position||!target||![position.x,position.y,position.z,target.x,target.y,target.z,up.x,up.y,up.z].every(Number.isFinite))return null;
      return {position:{...position},target:{x:target.x,y:target.y,z:target.z},up:{x:up.x,y:up.y,z:up.z}};
    };
    const hold=(milliseconds=1600)=>{spin=null;gesture=null;idleUntil=Math.max(idleUntil,now()+milliseconds);};
    const navigationStart=()=>{
      navigating=true;spin=null;
      gesture={view:readView(),at:now(),velocity:null,lastTurn:0,moved:false};
      onNavigateStart();
    };
    const navigationChange=()=>{
      if(!navigating||dragging||!gesture)return;
      const view=readView(),time=now();
      if(!view||!gesture.view)return;
      const velocity=flingVelocity(gesture.view,view,(time-gesture.at)/1000);
      if(velocity){gesture.velocity=velocity;gesture.lastTurn=time;gesture.moved=true;}
      gesture.view=view;gesture.at=time;
    };
    const navigationEnd=()=>{
      if(!navigating)return;
      controls.update?.(); // consume the last pointer move before measuring release
      navigating=false;
      const released=gesture;gesture=null;
      if(released?.moved)clickAfter=now()+250;
      if(!paused&&visible&&!dragging&&released?.velocity&&now()-released.lastTurn<160){
        spin=released.velocity;idleUntil=now();
      }else hold();
    };
    const navigationCancel=()=>{navigating=false;clickAfter=now()+250;hold();};
    controls.addEventListener('start',navigationStart);
    controls.addEventListener('change',navigationChange);
    controls.addEventListener('end',navigationEnd);
    controls.domElement?.addEventListener('pointercancel',navigationCancel);
    function tick(stamp){
      frame=0;if(paused||!visible){lastTick=null;return;}
      frame=requestFrame(tick);
      if(lastTick!==null&&stamp-lastTick<32)return; // bounded 30fps camera motion
      const delta=lastTick===null?0:Math.min(.08,(stamp-lastTick)/1000);lastTick=stamp;
      if(!delta||dragging||navigating||now()<idleUntil)return;
      const view=readView();if(!view)return;
      let position=view.position,speed=.045;
      if(spin){
        const coast=spinStep(position,view.target,view.up,spin,delta);
        position=coast.position;spin=coast.velocity;
        controls.object?.up.set(coast.up.x,coast.up.y,coast.up.z);
        speed*=1-Math.min(1,magnitude(spin)/.12); // ease back to the ambient orbit
        if(magnitude(spin)<.006)spin=null;
      }
      const next=orbitStep(position,view.target,phase,delta,speed);phase=next.phase;
      graph.cameraPosition(next.position,next.target,0);
    }
    function stopOrbit(){if(frame)cancelFrame(frame);frame=0;lastTick=null;}
    graph.warmupTicks(0).cooldownTicks(180).d3AlphaDecay(.028).d3VelocityDecay(.34).enableNodeDrag(true);
    graph.d3Force('charge').strength(-90);
    graph.d3Force('link').distance(link=>50+Math.min(90,28/Math.sqrt(Number(link.weight||1))));
    graph.onNodeDrag(node=>{
      if(paused||!visible)return;
      if(!dragging){dragging=true;spin=null;gesture=null;onDragStart(node);}
    }).onNodeDragEnd(node=>{
      if(!dragging)return;
      dragging=false;clickAfter=now()+250;hold();
      if(!paused&&visible)graph.d3ReheatSimulation();
      onDragEnd(node);
    });
    return {
      canSelect:()=>!dragging&&!navigating&&now()>=clickAfter,
      hold,
      setState(next){
        const wasPaused=paused;
        paused=Boolean(next.paused);visible=Boolean(next.visible);
        // Stop ticks, not the force constants: a paused filter change still
        // needs a synchronous warmup to display a usable, settled layout.
        graph.enableNodeDrag(!paused&&visible).cooldownTicks(paused?0:180);
        if(visible)graph.resumeAnimation();else graph.pauseAnimation();
        if(paused||!visible){stopOrbit();spin=null;gesture=null;navigating=false;}
        else if(!frame&&requestFrame)frame=requestFrame(tick);
        if(wasPaused&&!paused)graph.d3ReheatSimulation();
        if(dragging&&(paused||!visible)){dragging=false;clickAfter=now()+250;onDragEnd();}
      },
      dispose(){
        visible=false;stopOrbit();spin=null;gesture=null;
        controls.staticMoving=originalStaticMoving;
        controls.removeEventListener('start',navigationStart);controls.removeEventListener('change',navigationChange);controls.removeEventListener('end',navigationEnd);
        controls.domElement?.removeEventListener('pointercancel',navigationCancel);
      },
    };
  }
  const graphColors=Object.freeze({channel:'#42d3ff',person:'#c3f55d',topic:'#b58aff'});
  const graphNodeValue=node=>3+Math.min(14,Math.sqrt(node.videos.length)*1.3);
  const graphLinkWidth=link=>.5+Math.min(3.3,Math.sqrt(Number(link.weight||1))*.36);
  const api={filterVideos,buildGraph,evidenceVideos,evidenceFor,evidenceGroups,buildRating,ratingSubjects,ratingSubjectVideos,buildPeopleRating,neighborhood,layoutGraphLabels,layoutAdaptiveGraphLabels,nodeId,norm,idOf,createGraphDynamics,orbitStep,flingVelocity,spinStep,graphColors,graphNodeValue,graphLinkWidth};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GenealogyGraph=api;
})(globalThis);
