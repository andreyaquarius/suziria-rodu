(() => {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], Core=window.GenealogyGraph, Discovery=window.TopicDiscovery;
  const state={data:null,videos:[],graph:null,graphData:{nodes:[],links:[]},view:'map',mode:'channel_connections',search:'',category:'all',channel:'all',page:0,selection:null,evidenceTopic:null,evidencePerson:null,evidenceLimit:12,paused:matchMedia('(prefers-reduced-motion: reduce)').matches,expanded:false,focusNode:null,focusIds:new Set(),focusLinks:new Set(),fitTimer:0,labelsVisible:true,labelMode:'auto',labels:[],labelFrame:0};
  const music=new window.CosmicAudio();
  const cosmos=new window.CosmicMotion($('#starfield'),$('.cosmos'),{paused:state.paused});
  const titles={map:'У кожної історії є зв’язки.',rating:'Рейтинг генеалогічних каналів.',channels:'Канали, які досліджують рід.',topics:'Знайдіть свою тему.',people:'Люди генеалогічного простору.',videos:'Історії, до яких варто придивитись.'};
  const modeHelp={channel_overlap:'Спільні теми не означають особисту співпрацю. Натисніть на зв’язок, щоб побачити відео з обох каналів.',channel_topic:'Які теми досліджує кожен канал? Відкрийте вузол або лінію, щоб переглянути джерела.',people:'Люди, позначені учасниками одного відео. Згадки імен самі по собі не створюють зв’язок.',people_topics:'Люди беруть участь у відео на спільні теми, але не обов’язково разом. Для кожного учасника є окремі джерела.',channel_person:'На яких каналах зустрічається людина як учасник відео. Це не означає, що вона є власником каналу.',person_topic:'Теми у відео за участі людини. Це не обов’язково її особиста теза — перевірте контекст.',topic_topic:'Теми, що зустрічаються разом в одному відео. Виберіть пару, щоб побачити ці відео.'};
  const colors=Core.graphColors;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  modeHelp.channel_connections='Канали з’єднані через людей, які беруть участь у відео обох каналів. Товщина лінії — кількість спільних учасників. Натисніть зв’язок, щоб побачити імена та відео.';
  function linkWeightLabel(link){return link.relation==='channel_author'?'Автор каналу':`${link.weight} ${link.relation==='shared_people'?'спільних учасників':link.relation==='shared_topics'?'спільних тем':'відео'}`;}
  function personName(id){return state.data.people.find(p=>p.id===id)?.name||'';}
  Object.assign(state,{discoveryIndex:null,topicSelection:null,placeSelection:null,titleOnly:false,discoveryMatches:null,matchingVideoIds:null,pickerKind:'topic',pickerLimit:30});
  function updateDiscoveryFilters(){
    if(!state.topicSelection&&!state.placeSelection){state.titleOnly=false;$('#titleOnlyFilter').checked=false;}
    state.discoveryMatches=state.discoveryIndex?.select({topic:state.topicSelection,place:state.placeSelection,titleOnly:state.titleOnly})||null;
    state.matchingVideoIds=state.discoveryMatches?new Set(state.discoveryMatches.keys()):null;
    const topic=state.discoveryIndex?.get(state.topicSelection),place=state.discoveryIndex?.get(state.placeSelection);
    $('#topicPickerButton').textContent=topic?.name||'Обрати тему або підбірку ⌕';
    $('#placePickerButton').textContent=place?.name||'Обрати місто, село чи регіон ⌕';
    $('#titleOnlyFilter').disabled=!topic&&!place;
    $('#activeDiscoveryFilters').innerHTML=[topic,place].filter(Boolean).map(e=>`<button class="quiet-button" type="button" data-clear-discovery="${e.kind==='place'?'place':'topic'}" aria-label="Прибрати фільтр: ${esc(e.name)}">${esc(e.name)} ×</button>`).join('');
  }
  function openDiscoveryPicker(kind){
    if(!state.discoveryIndex)return;
    state.pickerKind=kind;state.pickerLimit=30;$('#discoveryQuery').value='';
    $('#discoveryTitle').textContent=kind==='place'?'Оберіть місцевість':'Оберіть тему або підбірку';
    $('#discoveryQuery').placeholder=kind==='place'?'Місто, село, регіон…':'ДНК, метрики, сповідки, переселення…';
    $('#discoveryPickerNote').textContent=kind==='place'?'Місцевості, визначені у змісті відео. Розташування архіву саме по собі не створює підбірки.':'Підбірки об’єднують споріднені теми. Нижче також доступні вузькі теми з аналізів відео.';
    const other=state.discoveryIndex.get(kind==='place'?state.topicSelection:state.placeSelection);
    const constraints=[other?.name,state.channel!=='all'?channelName(Number(state.channel)):null,state.search?`пошук «${state.search}»`:null,state.titleOnly?'збіг у назві':null].filter(Boolean);
    if(constraints.length)$('#discoveryPickerNote').textContent+=` З урахуванням: ${constraints.join(' · ')}.`;
    renderDiscoveryPicker();$('#discoveryDialog').showModal();$('#discoveryQuery').focus();
  }
  function renderDiscoveryPicker(){
    const other=state.pickerKind==='place'?{topic:state.topicSelection}:{place:state.placeSelection};
    const related=state.discoveryIndex.select({...other,titleOnly:state.titleOnly});
    const videos=Core.filterVideos(state.data,{search:state.search,category:state.category,channel:state.channel,videoIds:related?new Set(related.keys()):null});
    const options=state.discoveryIndex.options(state.pickerKind,{query:$('#discoveryQuery').value,videoIds:new Set(videos.map(v=>v.id)),titleOnly:state.titleOnly});
    $('#discoveryOptions').innerHTML=options.slice(0,state.pickerLimit).map(e=>`<button type="button" class="discovery-option" data-discovery-kind="${e.kind}" data-discovery-id="${esc(e.id)}"><span><small>${e.kind==='collection'?'ПІДБІРКА':e.kind==='place'?esc(e.hint):'ВУЗЬКА ТЕМА'}</small><strong>${esc(e.name)}</strong>${e.kind==='collection'?`<span class="muted">${esc(e.hint)}</span>`:''}</span><span class="discovery-option-count">${e.count} відео ↗</span></button>`).join('')||'<p class="muted">Збігів не знайдено. Спробуйте коротшу назву або приберіть інший фільтр.</p>';
    $('#discoveryOptionCount').textContent=`Показано ${Math.min(options.length,state.pickerLimit)} із ${options.length}`;
    $('#moreDiscoveryOptions').hidden=options.length<=state.pickerLimit;
  }
  function chooseDiscovery(kind,id){
    const selection={kind,id:kind==='collection'?id:Number(id)};
    if(!state.discoveryIndex?.get(selection))return;
    if(kind==='place')state.placeSelection=selection;else state.topicSelection=selection;
    if($('#discoveryDialog').open)$('#discoveryDialog').close();
    if(state.view==='videos')refresh();else location.hash='videos';
  }
  function renderDiscoverySummary(){
    $('#showFilteredVideos').textContent=`Показати відео (${state.videos.length})`;
    $('#showFilteredVideos').hidden=state.view==='videos';
    $('#selectionSummary').hidden=state.view!=='videos'||!state.discoveryMatches;
    if(!$('#selectionSummary').hidden){
      const labels=[state.topicSelection,state.placeSelection].filter(Boolean).map(s=>state.discoveryIndex.get(s)?.name);
      $('#selectionSummary').innerHTML=`<h2>${labels.map(esc).join(' · ')}</h2><p>${state.videos.length} відео${state.titleOnly?' · збіг у назві відео':' · спочатку найточніші збіги'}${state.topicSelection&&state.placeSelection?' · тема й місцевість в одному відео':''}.</p>`;
    }
    $('#topicCollections').hidden=state.view!=='topics';
    if(state.view==='topics'){
      const options=state.discoveryIndex.options('topic',{videoIds:new Set(state.videos.map(v=>v.id)),titleOnly:state.titleOnly}).filter(e=>e.kind==='collection');
      $('#topicCollections').innerHTML=`<h2>Що хочете дослідити?</h2><div class="collection-grid">${options.map(e=>`<button class="glass collection-card" type="button" data-discovery-kind="collection" data-discovery-id="${e.id}"><strong>${esc(e.name)}</strong><span>${esc(e.hint)}</span><small>${e.count} відео ↗</small></button>`).join('')}</div><h2>Вузькі теми</h2><button type="button" class="quiet-button" data-open-topic-picker>Знайти конкретну тему ⌕</button>`;
    }
  }
  function observeResponsiveLayout(){
    let pending=false;
    const update=()=>{
      pending=false;
      const root=document.documentElement,footer=$('.site-footer'),toolbar=$('.map-toolbar');
      const write=(name,value)=>{const px=`${Math.ceil(value)}px`;if(root.style.getPropertyValue(name)!==px)root.style.setProperty(name,px);};
      write('--visible-height',window.visualViewport?.height||window.innerHeight);
      if(state.view!=='map')return;
      const top=state.expanded?12:Math.max($('.site-header').getBoundingClientRect().bottom,$('.intro').getBoundingClientRect().bottom)+10;
      write('--map-tools-top',top);
      write('--map-drawer-top',top+toolbar.offsetHeight+8);
      write('--map-footer-height',state.expanded?0:footer.offsetHeight);
      write('--map-controls-height',$('.graph-bottom').offsetHeight);
    };
    const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(update);}};
    const observer=new ResizeObserver(schedule);
    ['.site-header','.intro','.map-toolbar','.site-footer','.graph-bottom'].forEach(selector=>observer.observe($(selector)));
    new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',schedule);
    window.visualViewport?.addEventListener('resize',schedule);
    schedule();
  }
  function initGraph(){
    try{
      if(!window.ForceGraph3D) throw new Error('WebGL unavailable');
      state.avatars=window.ChannelAvatars?.create({nodeValue:Core.graphNodeValue});
      // Use the same TrackballControls as /admin. OrbitControls in this bundled
      // renderer fails on the synthetic pointerup used by node-drag cleanup.
      state.graph=window.ForceGraph3D({controlType:'trackball'})($('#cosmicGraph'))
        .backgroundColor('rgba(0,0,0,0)').showNavInfo(false)
        .nodeColor(n=>colors[n.type]).nodeVal(Core.graphNodeValue).nodeOpacity(.98).nodeResolution(18)
        .nodeLabel(n=>esc(n.label)).linkColor(()=>'rgba(133,194,255,.78)').linkOpacity(.55)
        .linkWidth(Core.graphLinkWidth).linkDirectionalParticles(1).linkDirectionalParticleWidth(1.8).linkDirectionalParticleSpeed(.003)
        .linkDirectionalParticleColor(()=>'#c8f3ff')
        .linkLabel(l=>esc(linkWeightLabel(l)+(l.people?.length?' · '+l.people.slice(0,3).map(personName).join(', '):'')))
        .onNodeHover(node=>{for(const item of state.labels){item.button.classList.toggle('is-hovered',item.node.id===node?.id);item.line.classList.toggle('is-hovered',item.node.id===node?.id);}})
        .onNodeClick(selectGraphNode)
        .onLinkClick(l=>{if(state.dynamics.canSelect())openEvidence(l);})
        .onBackgroundClick(()=>{if(state.dynamics.canSelect())clearNodeFocus();});
      if(state.avatars)state.graph.nodeThreeObject(state.avatars.nodeObject).nodeThreeObjectExtend(false);
      state.dynamics=Core.createGraphDynamics(state.graph,{
        onNavigateStart(){clearTimeout(state.fitTimer);},
        onDragStart(){clearTimeout(state.fitTimer);$('#graphStage').classList.add('is-dragging');},
        onDragEnd(){$('#graphStage').classList.remove('is-dragging');},
      });
      new ResizeObserver(resizeGraph).observe($('#graphStage'));
      renderMotion();
    }catch(_){state.graph=null;$('#graphMessage').textContent='Сузір’я недоступне на цьому пристрої. Усі зв’язки й відео доступні у списках.';}
  }
  function resizeGraph(){if(!state.graph||state.view!=='map')return;const el=$('#graphStage');state.graph.width(el.clientWidth).height(el.clientHeight);}
  function styleGraphSelection(){
    if(!state.graph)return;
    state.avatars?.setSelection(state.focusNode?.id,state.focusIds);
    // Limit decorative particles on large maps, never their nodes or links.
    const stride=Math.max(1,Math.ceil(state.graphData.links.length/500));
    const animated=new Set(state.graphData.links.filter((_,index)=>index%stride===0).map(link=>link.id));
    state.graph.nodeColor(n=>!state.focusNode||state.focusIds.has(n.id)?colors[n.type]:'#22314a')
      .nodeVal(n=>Core.graphNodeValue(n)*(n.id===state.focusNode?.id?1.5:1))
      .linkColor(l=>state.focusNode?(state.focusLinks.has(l.id)?'#c3f55d':'rgba(71,95,126,.08)'):'rgba(133,194,255,.78)')
      .linkWidth(l=>Core.graphLinkWidth(l)*(state.focusLinks.has(l.id)?1.6:1))
      .linkDirectionalParticles(l=>state.paused?0:state.focusNode?(state.focusLinks.has(l.id)?2:0):animated.has(l.id)?1:0);
  }
  function centerFocusedNode(){
    const node=state.focusNode;if(!state.graph||!node||!Number.isFinite(node.x))return;
    state.dynamics.hold(1200);
    const camera=state.graph.cameraPosition(),dx=camera.x-node.x,dy=camera.y-node.y,dz=camera.z-node.z,length=Math.hypot(dx,dy,dz)||1;
    const neighbors=state.graph.graphData().nodes.filter(n=>state.focusIds.has(n.id)&&Number.isFinite(n.x));
    const radius=Math.max(100,...neighbors.map(n=>Math.hypot(n.x-node.x,n.y-node.y,(n.z||0)-(node.z||0))));
    const aspect=$('#graphStage').clientWidth/Math.max(1,$('#graphStage').clientHeight),distance=Math.max(260,radius*1.8/Math.min(1,aspect));
    state.graph.cameraPosition({x:node.x+dx/length*distance,y:node.y+dy/length*distance,z:(node.z||0)+(length===1?distance:dz/length*distance)},node,state.paused?0:900);
  }
  function selectGraphNode(node){
    if(!node||!state.dynamics?.canSelect())return;
    // Label clicks use the immutable catalog node; the renderer owns positions.
    node=state.graph.graphData().nodes.find(n=>n.id===node.id)||node;
    clearTimeout(state.fitTimer);state.focusNode=node;
    const area=Core.neighborhood(state.graphData,node.id);state.focusIds=new Set(area.nodes);state.focusLinks=new Set(area.links);
    $('#focusTitle').textContent=node.label;$('#focusKind').textContent=({channel:'ОБРАНИЙ КАНАЛ',person:'ОБРАНА ЛЮДИНА',topic:'ОБРАНА ТЕМА'})[node.type]||'ОБРАНИЙ ВУЗОЛ';
    $('#focusStats').textContent=`${Math.max(0,area.nodes.length-1)} пов’язаних вузлів у поточному сузір’ї · ${node.videos.length} відео`;
    $('#showNodeVideos').textContent=`Показати відео (${node.videos.length})`;$('#nodeFocus').hidden=false;
    styleGraphSelection();labels();renderConnections();centerFocusedNode();
  }
  function clearNodeFocus(refit=true){
    clearTimeout(state.fitTimer);state.focusNode=null;state.focusIds=new Set();state.focusLinks=new Set();$('#nodeFocus').hidden=true;
    if(refit){state.dynamics?.hold(1200);styleGraphSelection();labels();renderConnections();state.graph?.zoomToFit(state.paused?0:800,60);}
  }
  function setPanel(name,open){
    const options=name==='options',panel=$(options?'#graphOptions':'#connectionsPanel'),toggle=$(options?'#optionsToggle':'#connectionsToggle');
    if(open){const other=$(options?'#connectionsPanel':'#graphOptions'),otherToggle=$(options?'#connectionsToggle':'#optionsToggle');other.hidden=true;otherToggle.setAttribute('aria-expanded','false');}
    panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
    if(open)(options?$('#searchInput'):panel.querySelector('button[data-close-panel]')).focus();else toggle.focus();
  }
  function setExpanded(expanded){
    state.expanded=expanded;document.body.classList.toggle('graph-expanded',expanded);$('#mapView').classList.toggle('is-expanded',expanded);
    const button=$('#expandGraph');button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',expanded?'Згорнути повноекранний граф':'Розгорнути граф на весь екран');button.innerHTML=expanded?'⛶ <span>Згорнути</span>':'⛶ <span>На весь екран</span>';
    state.dynamics?.hold(1200);
    requestAnimationFrame(()=>{resizeGraph();if(state.focusNode)centerFocusedNode();else state.graph?.zoomToFit(700,45);});
  }
  function toggleLabels(){
    state.labelsVisible=!state.labelsVisible;
    $('#graphLabels').hidden=!state.labelsVisible;
    $('#graphLabelLines').toggleAttribute('hidden',!state.labelsVisible);
    const button=$('#labelsToggle');
    button.textContent=state.labelsVisible?'Приховати підписи':'Показати підписи';
    button.setAttribute('aria-pressed',String(!state.labelsVisible));
    button.title=state.labelsVisible?'Приховати постійні підписи; назви залишаться при наведенні на кружечок':'Назви з’являються при наведенні на кружечок. Натисніть, щоб увімкнути підписи';
    // The renderer's nodeLabel tooltip stays enabled independently of the overlay.
  }
  function setLabelMode(mode){
    if(!['auto','all'].includes(mode))return;
    state.labelMode=mode;$('#labelMode').value=mode;
    if(!state.labelsVisible)toggleLabels();
    labels();
  }
  function labels(){
    cancelAnimationFrame(state.labelFrame);$('#graphLabels').replaceChildren();$('#graphLabelLines').replaceChildren();
    if(!state.graph)return;
    const buttons=document.createDocumentFragment(),lines=document.createDocumentFragment(),degrees=new Map();
    for(const link of state.graphData.links)for(const id of [Core.idOf(link.source),Core.idOf(link.target)])degrees.set(id,(degrees.get(id)||0)+1);
    state.labels=[...state.graph.graphData().nodes].sort((a,b)=>Number(b.id===state.focusNode?.id)-Number(a.id===state.focusNode?.id)||Number(state.focusIds.has(b.id))-Number(state.focusIds.has(a.id))||b.weight-a.weight).map(node=>{
      const button=document.createElement('button'),text=document.createElement('span'),line=document.createElementNS('http://www.w3.org/2000/svg','line');
      button.className='graph-label';button.dataset.nodeId=node.id;button.style.setProperty('--node-color',colors[node.type]);
      button.classList.toggle('is-focused',node.id===state.focusNode?.id);button.classList.toggle('is-muted',Boolean(state.focusNode&&!state.focusIds.has(node.id)));
      text.className='graph-label-text';text.textContent=node.label;button.append(text);button.title=node.label;button.type='button';
      button.setAttribute('aria-pressed',String(node.id===state.focusNode?.id));button.addEventListener('click',()=>selectGraphNode(node));
      line.style.setProperty('--node-color',colors[node.type]);line.dataset.nodeId=node.id;
      const priority=Math.log1p(Math.max(0,node.weight||0))*3+Math.log1p(degrees.get(node.id)||0)*2+(node.type==='channel'?.6:0);
      buttons.append(button);lines.append(line);return {node,button,line,priority,width:0,height:0,previous:null};
    });
    $('#graphLabels').append(buttons);$('#graphLabelLines').append(lines);
    let lastTick=0;
    const tick=()=>{
      if(state.view!=='map'||document.hidden){state.labelFrame=0;return;}
      if(!state.labelsVisible){state.labelFrame=requestAnimationFrame(tick);return;}
      if(performance.now()-lastTick<32){state.labelFrame=requestAnimationFrame(tick);return;}lastTick=performance.now();
      const bounds=$('#graphStage').getBoundingClientRect(),camera=state.graph.cameraPosition(),controls=state.graph.controls(),target=controls.target;
      const distance=Math.hypot(camera.x-target.x,camera.y-target.y,camera.z-target.z)||1;
      const nodes=state.labels.map(item=>item.node).filter(n=>[n.x,n.y,n.z].every(Number.isFinite));
      const span=nodes.length?Math.max(...['x','y','z'].map(axis=>Math.max(...nodes.map(n=>n[axis]))-Math.min(...nodes.map(n=>n[axis])))):0;
      const fov=(controls.object?.fov||50)*Math.PI/180,aspect=bounds.width/Math.max(1,bounds.height);
      const zoom=span*1.35/(2*Math.tan(fov/2)*Math.min(1,aspect)*distance)||1;
      const up=controls.object?.up||{x:0,y:1,z:0};
      const obstacles=$$('.site-header,.intro,.map-toolbar button,#activeModeLabel,.graph-bottom,.site-footer,#graphOptions,#connectionsPanel,#nodeFocus').flatMap(el=>{
        if(el.hidden||getComputedStyle(el).visibility==='hidden')return [];
        const r=el.getBoundingClientRect();return r.width&&r.height?[{x:r.x-bounds.x,y:r.y-bounds.y,width:r.width,height:r.height}]:[];
      });
      // Read dimensions together before writing positions: no layout read/write
      // loop per node, and resized fonts/viewport keep their real label sizes.
      const inputs=state.labels.flatMap(item=>{
        const {node,button}=item;
        item.width=button.offsetWidth||item.width;item.height=button.offsetHeight||item.height;
        if(![node.x,node.y,node.z].every(Number.isFinite))return [];
        if((node.x-camera.x)*(target.x-camera.x)+(node.y-camera.y)*(target.y-camera.y)+(node.z-camera.z)*(target.z-camera.z)<=0)return [];
        const p=state.graph.graph2ScreenCoords(node.x,node.y,node.z);
        const worldRadius=4*Math.cbrt(Core.graphNodeValue(node)*(node.id===state.focusNode?.id?1.5:1));
        const edge=state.graph.graph2ScreenCoords(node.x+up.x*worldRadius,node.y+up.y*worldRadius,node.z+up.z*worldRadius);
        return [{id:node.id,x:p.x,y:p.y,width:item.width,height:item.height,previous:item.previous,priority:item.priority,
          radius:Math.hypot(edge.x-p.x,edge.y-p.y),related:state.focusIds.has(node.id),
          pinned:node.id===state.focusNode?.id||document.activeElement===button||button.matches(':hover')}];
      });
      const layout=state.labelMode==='all'?Core.layoutGraphLabels:Core.layoutAdaptiveGraphLabels;
      const positions=new Map(layout(inputs,{width:bounds.width,height:bounds.height,relax:!state.paused,zoom,focused:Boolean(state.focusNode)},obstacles).map(p=>[p.id,p]));
      for(const item of state.labels){
        const p=positions.get(item.node.id);item.button.hidden=!p;item.line.style.display=p?'':'none';
        if(!p){item.previous=null;continue;}
        item.previous=p;item.button.style.left=`${p.x}px`;item.button.style.top=`${p.y}px`;
        item.line.setAttribute('x1',p.anchorX);item.line.setAttribute('y1',p.anchorY);item.line.setAttribute('x2',p.endX);item.line.setAttribute('y2',p.endY);
      }
      state.labelFrame=requestAnimationFrame(tick);
    };tick();
  }
  function renderMap(){
    clearNodeFocus(false);
    const channelOverlap=state.channel!=='all'&&['channel_overlap','channel_connections'].includes(state.mode);
    const videos=channelOverlap?Core.filterVideos(state.data,{search:state.search,category:state.category,videoIds:state.matchingVideoIds}):state.videos;
    state.graphData=Core.buildGraph(state.data,videos,{mode:state.mode,minWeight:Number($('#densitySelect').value),category:state.category,channel:state.channel});
    const g=state.graphData;
    $('#modeDescription').textContent=(channelOverlap?'Перетини обраного каналу з іншими. ':'')+modeHelp[state.mode];
    $$('#densitySelect option').forEach(option=>{if(option.value!=='1')option.textContent=`Від ${option.value} ${state.mode==='channel_connections'?'спільних учасників':['channel_overlap','people_topics'].includes(state.mode)?'спільних тем':'відео'}`;});
    $('#graphCount').textContent=`${g.nodes.length} вузлів · ${g.links.length} зв’язків${g.truncated?' · показано найсильніші':''}`;
    if(state.graph){
      state.dynamics.hold(2100);
      const renderData={nodes:g.nodes.map(n=>({...n})),links:g.links.map(l=>({...l}))};
      // Avatars must belong to the exact nodes bound by the 3D renderer.
      state.avatars?.sync(renderData.nodes);
      // Layout new data synchronously only when motion is explicitly paused.
      state.graph.nodeResolution(g.nodes.length>1500?8:g.nodes.length>500?12:18)
        .warmupTicks(state.paused?100:0).graphData(renderData);
      $('#graphMessage').hidden=g.nodes.length>0;$('#graphMessage').textContent=channelOverlap?'За цими фільтрами канал не має перетинів. Спробуйте режим «Канал ↔ тема» або «Канал ↔ людина».':'Немає зв’язків за цими фільтрами. Спробуйте інший канал, категорію або меншу щільність.';styleGraphSelection();resizeGraph();labels();state.fitTimer=setTimeout(()=>{if(!state.focusNode&&state.view==='map')state.graph.zoomToFit(state.paused?0:900,60);},850);
    }
    renderConnections();
  }
  function renderConnections(){
    const g=state.graphData;
    const byId=new Map(g.nodes.map(n=>[n.id,n]));
    const links=state.focusNode?g.links.filter(l=>state.focusLinks.has(l.id)):g.links.slice(0,6);
    $('#connectionsHeading').textContent=state.focusNode?'Зв’язки обраного вузла':'Почніть зі зв’язку';$('#connectionsNote').textContent=state.focusNode?`Для «${state.focusNode.label}». Виберіть перетин, щоб переглянути відеоджерела.`:'Оберіть вузол у сузір’ї або один із перетинів нижче.';
    $('#connectionsList').innerHTML=links.map(l=>`<button class="connection" data-connection="${g.links.indexOf(l)}" type="button"><strong>${esc(byId.get(Core.idOf(l.source))?.label)} <span class="join">↔</span> ${esc(byId.get(Core.idOf(l.target))?.label)}</strong><p>${l.relation==='shared_people'?l.people.slice(0,3).map(id=>esc(personName(id))).join(' · ')+(l.people.length>3?` · ще ${l.people.length-3}`:''):l.topics.slice(0,2).map(id=>esc(topicName(id))).join(' · ')}</p><small>${esc(linkWeightLabel(l))} ↗</small></button>`).join('')||'<p class="muted">Змініть фільтри, щоб знайти інші зв’язки.</p>';
  }
  function renderMotion(){cosmos.setPaused(state.paused);const b=$('#motionToggle');b.textContent=state.paused?'▷':'Ⅱ';b.setAttribute('aria-pressed',String(state.paused));b.setAttribute('aria-label',state.paused?'Продовжити рух':'Призупинити рух');b.title=state.paused?'Продовжити рух графа та зоряного неба':'Призупинити рух графа та зоряного неба';if(state.graph){state.dynamics.setState({paused:state.paused,visible:!document.hidden&&state.view==='map'});styleGraphSelection();}}
  function refresh(){if(!state.data)return;state.page=0;updateDiscoveryFilters();state.videos=Core.filterVideos(state.data,{search:state.search,category:state.category,channel:state.channel,videoIds:state.matchingVideoIds});if(state.discoveryMatches)state.videos.sort((a,b)=>state.discoveryMatches.get(b.id).score-state.discoveryMatches.get(a.id).score);renderDiscoverySummary();if(state.view==='map')renderMap();else renderCatalog();}
  function changeView(){
    const view=location.hash.slice(1)||'map';state.view=Object.hasOwn(titles,view)?view:'map';state.page=0;
    document.body.classList.toggle('view-map',state.view==='map');
    $(state.view==='map'?'#graphStage .graph-actions':'.sound-controls').append($('#motionToggle'));
    if(state.view==='map')$('#mapFilters').append($('#discoveryBar'));else{if(state.expanded)setExpanded(false);$('#main').insertBefore($('#discoveryBar'),$('#catalogView'));}
    $('#viewTitle').textContent=titles[state.view];$('#mapView').hidden=state.view!=='map';$('#catalogView').hidden=state.view==='map';
    $$('[data-view]').forEach(a=>{if(a.dataset.view===state.view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    document.title=`${state.view==='map'?'Сузір’я роду':({rating:'Рейтинг',channels:'Канали',topics:'Теми',people:'Люди',videos:'Відео'})[state.view]+' — Сузір’я роду'} — Український генеалогічний YouTube`;
    $('#ratingExplanation').hidden=state.view!=='rating';
    if(state.graph)renderMotion();if(state.data)refresh();
  }
  function safeImage(value){try{const url=new URL(value);return url.protocol==='https:'&&['yt3.ggpht.com','yt3.googleusercontent.com','i.ytimg.com'].includes(url.hostname)?url.href:null;}catch(_){return null;}}
  function channelName(id){return state.data.channels.find(c=>c.id===id)?.title||'';}
  function topicName(id){return state.data.topics.find(t=>t.id===id)?.name||'';}
  function formatDate(value){if(!value)return '';const date=new Date(value);return Number.isNaN(date.valueOf())?'':new Intl.DateTimeFormat('uk',{day:'numeric',month:'short',year:'numeric'}).format(date);}
  function timecode(value){const seconds=Math.max(0,Math.floor(Number(value)||0));const hours=Math.floor(seconds/3600);return `${hours?hours+':':''}${String(Math.floor(seconds/60)%60).padStart(hours?2:1,'0')}:${String(seconds%60).padStart(2,'0')}`;}
  function baseVideoCard(v, evidence=false){
    const proof=evidence?Core.evidenceFor(v,state.selection||{},state.evidenceTopic,state.evidencePerson):null;
    return `<article class="video-card ${evidence?'with-evidence':''}"><button class="video-thumb" data-play="${v.id}" type="button" aria-label="Дивитися: ${esc(v.title)}"><img src="https://i.ytimg.com/vi/${esc(v.youtube_id)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span class="play-symbol" aria-hidden="true">▷</span>${v.duration?`<span class="duration">${timecode(v.duration)}</span>`:''}</button><div class="video-copy"><p class="card-kicker">${esc(channelName(v.channel_id))}${v.published_at?' · '+formatDate(v.published_at):''}</p><h3><button class="title-button" type="button" data-play="${v.id}">${esc(v.title)}</button></h3><p class="video-summary">${esc(v.summary)}</p><div class="card-topics">${v.topics.slice(0,3).map(id=>`<button data-entity="topic_${id}" type="button">${esc(topicName(id))}</button>`).join('')}</div>${evidence?`<p class="source-basis">Підстава зв’язку: ${v.basis==='captions'?'доступні субтитри':'назва та опис відео; перевірте зміст під час перегляду'}.</p>${proof?.text?`<p class="evidence-text">${esc(proof.text)}</p>`:''}`:''}<div class="video-actions"><button class="primary-button" data-play="${v.id}" type="button">▷ Дивитися тут</button><a href="https://www.youtube.com/watch?v=${esc(v.youtube_id)}" target="_blank" rel="noopener noreferrer">YouTube ↗</a>${proof?.at!=null?`<button class="quiet-button" data-play="${v.id}" data-start="${proof.at}" type="button">З ${timecode(proof.at)}</button>`:''}</div></div></article>`;
  }
  function videoCard(v,evidence=false){
    let markup=baseVideoCard(v,evidence);
    if(!evidence&&state.discoveryMatches?.has(v.id)){
      const reasons=state.discoveryMatches.get(v.id).reasons;
      const notes=`<div class="discovery-match">${reasons.map(r=>`<p><strong>${esc(r.label)}</strong> · ${r.basis==='title'?'у назві відео':r.basis==='captions'?'за субтитрами':'за описом'}</p>${r.basis!=='title'?`<blockquote>${esc(r.text)}</blockquote>`:''}${r.at!=null?`<button class="quiet-button" type="button" data-play="${v.id}" data-start="${r.at}">▷ Перейти до ${timecode(r.at)}</button>`:''}`).join('')}</div>`;
      markup=markup.replace('<div class="video-actions">',notes+'<div class="video-actions">');
    }
    if(evidence&&state.selection?.relation==='shared_people'){
      const people=(state.selection.people||[]).filter(id=>v.people.includes(id)&&(state.evidencePerson==null||id===state.evidencePerson));
      markup=markup.replace('<p class="source-basis">',`<p class="connection-participants">Участь у відео: <strong>${people.map(id=>esc(personName(id))).join(' · ')}</strong></p><p class="source-basis">`);
    }
    if(!evidence||!v.rating)return markup;
    const basis=v.rating.basis||[],personId=state.selection?.id?.startsWith('person_')?Number(state.selection.id.slice(7)):null;
    const personal=(v.person_topics||[]).filter(p=>p.person_id===personId&&(!state.selection.topics?.length||state.selection.topics.includes(p.topic_id)));
    const notes=`<details class="rating-components"><summary>Теми та спікери</summary><p>${basis.length?basis.slice(0,4).map(b=>esc(b.name)).join(' · '):'Тематичних відомостей недостатньо.'}</p>${personId!=null?(personal.length?personal.map(p=>`<p>${esc(topicName(p.topic_id))}: ${p.basis==='explicit'?'зв’язок із темою зазначено в тексті':'ймовірний спікер'}${p.text?` — «${esc(p.text)}»`:''}</p>`).join(''):'<p>Участь у відео відома, але обговорення цих тем не підтверджено.</p>'):''}</details>`;
    return markup.replace('<div class="video-actions">',notes+'<div class="video-actions">');
  }
  function renderCatalog(){
    if(!state.data)return;
    let records;
    if(state.view==='videos')records=state.videos;
    else if(state.view==='rating'){
      const persons=$('#ratingEntity').value==='people';$('#ratingTopicField').hidden=!persons;
      if(persons){const ids=new Set(state.videos.flatMap(v=>v.people));records=Core.buildPeopleRating(state.data,{topic:$('#ratingTopic').value}).filter(p=>ids.has(p.id));}
      else {const channels=new Set(state.videos.map(v=>v.channel_id));records=Core.buildRating(state.data).filter(c=>channels.has(c.id));}
    }
    else if(state.view==='topics'){
      const videos=new Map(state.videos.map(v=>[v.id,v]));
      records=state.discoveryIndex.options('topic',{videoIds:new Set(videos.keys()),titleOnly:state.titleOnly}).filter(e=>e.kind==='topic'&&(state.category==='all'||e.category===state.category)).map(e=>({...e,matching:[...e.matches].filter(([id,r])=>videos.has(id)&&(!state.titleOnly||r.basis==='title')).map(([id])=>videos.get(id))}));
    }
    else{
      const field={channels:'channel_id',topics:'topics',people:'people'}[state.view];
      records=state.data[state.view].map(item=>({...item,matching:state.videos.filter(v=>Array.isArray(v[field])?v[field].includes(item.id):v[field]===item.id)})).filter(item=>item.matching.length);
      if(state.view==='topics'&&state.category!=='all')records=records.filter(t=>t.category===state.category);
      records.sort((a,b)=>b.matching.length-a.matching.length||(a.title||a.name).localeCompare(b.title||b.name,'uk'));
    }
    const pageSize=12,start=state.page*pageSize,visible=records.slice(start,start+pageSize);
    const root=$('#catalogResults');root.classList.toggle('videos-grid',state.view==='videos');root.classList.toggle('rating-list',state.view==='rating');
    root.innerHTML=visible.map(item=>{
      if(state.view==='videos')return videoCard(item);
      if(state.view==='rating')return ratingCard(item);
      const kind={channels:'channel',topics:'topic',people:'person'}[state.view],name=item.title||item.name;
      const topicIds=[...new Set(item.matching.flatMap(v=>v.topics))],channelCount=new Set(item.matching.map(v=>v.channel_id)).size;
      const img=state.view==='channels'?safeImage(item.thumbnail):null;
      const category=state.data.categories.find(c=>c.id===item.category);
      const openAttributes=kind==='topic'?`data-discovery-kind="topic" data-discovery-id="${item.id}"`:`data-entity="${kind}_${item.id}"`;
      return `<article class="entity-card glass"><div class="entity-top"><div class="entity-avatar ${kind}">${esc(name.split(/\s+/).slice(0,2).map(s=>s[0]).join(''))}${img?`<img src="${esc(img)}" alt="" loading="lazy" width="60" height="60">`:''}</div><span class="card-kicker">${esc(category?.name||({channel:'YouTube-канал',person:'Учасник відео',topic:'Тема'})[kind])}</span></div><h2>${esc(name)}</h2><p class="entity-counts">${item.matching.length} відео · ${kind==='channel'?topicIds.length+' тем':channelCount+' каналів'}</p><div class="card-topics">${topicIds.filter(id=>kind!=='topic'||id!==item.id).slice(0,3).map(id=>`<button type="button" data-entity="topic_${id}">${esc(topicName(id))}</button>`).join('')}</div><button type="button" class="entity-open" ${openAttributes}>Переглянути відео <span>↗</span></button></article>`;
    }).join('')||'<div class="catalog-empty glass"><h2>За цими фільтрами нічого не знайдено</h2><p>Змініть пошук, канал або категорію.</p></div>';
    $('#pageInfo').textContent=records.length?`${start+1}–${Math.min(start+pageSize,records.length)} із ${records.length}`:'Знайдено: 0';$('#prevPage').disabled=state.page===0;$('#nextPage').disabled=start+pageSize>=records.length;
  }
  function ratingComponents(item){
    const c=item.components||{},number=n=>Number(n||0).toLocaleString('uk',{maximumFractionDigits:2});
    return `<details class="rating-components"><summary>За що бали</summary><p>Тематика: ${number(c.thematic)} балів · Джерела й методи: ${number(c.research)} балів</p></details>`;
  }
  function channelAuthors(id){
    const authors=state.data.channels.find(c=>c.id===Number(id))?.authors||[];
    return authors.length?`<p class="channel-authors">${authors.length===1?'Автор каналу':'Автори каналу'}: ${authors.map(a=>`<button class="title-button" type="button" data-entity="person_${Number(a.person_id)}">${esc(a.name)}</button>`).join(', ')}</p>`:'';
  }
  function ratingVideoCounts(item){
    const counts={all:item.videos.length,genealogy:item.genealogy_videos,local_history:item.local_history_videos,history:item.history_videos};
    return `<div class="rating-video-counts" role="group" aria-label="Відео каналу за напрямами">${Object.entries(Core.ratingSubjects).map(([subject,name])=>{
      const count=Number(counts[subject]||0),label=subject==='all'?'Усі відео':name;
      return `<button type="button" class="rating-video-filter${count?'':' is-empty'}" data-rating-channel="${item.id}" data-rating-subject="${subject}" aria-haspopup="dialog" aria-label="${esc(name)} відео: ${count} — ${esc(item.title)}"><span>${esc(label)}</span><strong>${count}</strong><span aria-hidden="true">↗</span></button>`;
    }).join('')}</div>`;
  }
  function ratingCard(item){
    if(item.entity_type==='person')return `<article class="rating-row glass"><span class="rating-position" aria-label="Місце ${item.rank}">${item.rank}</span><div class="entity-avatar person">${esc(item.title.split(/\s+/).slice(0,2).map(s=>s[0]).join(''))}</div><div class="rating-channel"><h2>${esc(item.title)}</h2><p>Тематичні виступи: ${item.videos.length} · Канали участі: ${item.channel_count}</p><div class="card-topics">${item.top_topics.map(t=>`<button type="button" data-rating-topic="${t.topic_id}">${esc(topicName(t.topic_id))}</button>`).join('')}</div>${ratingComponents(item)}</div><div class="rating-score"><strong>${Number(item.score).toLocaleString('uk',{maximumFractionDigits:2})}</strong><span>балів</span></div><button class="quiet-button rating-videos" type="button" data-rating-person="${item.id}">${item.videos.length?'Виступи':'Відео участі'} ↗</button></article>`;
    const img=safeImage(item.thumbnail),initials=item.title.split(/\s+/).slice(0,2).map(s=>s[0]).join('');
    return `<article class="rating-row glass"><span class="rating-position" aria-label="Місце ${item.rank}">${String(item.rank).padStart(2,'0')}</span><div class="entity-avatar channel">${esc(initials)}${img?`<img src="${esc(img)}" alt="" loading="lazy" width="60" height="60">`:''}</div><div class="rating-channel"><h2><button class="title-button" type="button" data-rating-channel="${item.id}" data-rating-subject="all" aria-haspopup="dialog">${esc(item.title)}</button></h2>${channelAuthors(item.id)}${ratingVideoCounts(item)}${ratingComponents(item)}</div><div class="rating-score"><strong>${Number(item.score).toLocaleString('uk',{maximumFractionDigits:2})}</strong><span>балів</span></div><button class="quiet-button rating-videos" type="button" data-rating-channel="${item.id}" data-rating-subject="all" aria-haspopup="dialog">Відеоджерела ↗</button></article>`;
  }
  function openRatingChannel(id,subject='all'){
    const channel=state.data.channels.find(c=>c.id===Number(id));if(!channel||!Object.hasOwn(Core.ratingSubjects,subject))return;
    const videos=Core.ratingSubjectVideos(state.data,id,subject);
    openEvidence({id:`channel_${channel.id}`,label:`${Core.ratingSubjects[subject]} відео — ${channel.title}`,videos:videos.map(v=>v.id),ratingSubject:subject});
    $('#evidenceEyebrow').textContent='ВІДЕО КАНАЛУ';
    $('#evidenceNote').textContent=`${videos.length} відео${subject==='all'?' в каталозі.':'. Одне відео може належати до кількох напрямів.'}`;
  }
  function openRatingPerson(id){
    const person=Core.buildPeopleRating(state.data,{topic:$('#ratingTopic').value}).find(p=>p.id===Number(id));if(!person)return;
    const videos=person.videos.length?person.videos:state.data.videos.filter(v=>v.people.includes(person.id)).map(v=>v.id);
    openEvidence({id:`person_${person.id}`,label:person.title,videos,topics:$('#ratingTopic').value==='all'?[]:[Number($('#ratingTopic').value)]});
    $('#evidenceNote').textContent=person.videos.length?'Відео за обраними темами. Ймовірних спікерів позначено в картках.':'Відео за участю цієї людини. Обговорювані нею теми не підтверджені.';
  }
  function openEntity(id){
    const [kind,raw]=id.split('_'),entityId=Number(raw),table={channel:'channels',person:'people',topic:'topics'}[kind];if(!table)return;
    const entity=state.data[table].find(item=>item.id===entityId);if(!entity)return;
    const field={channel:'channel_id',person:'people',topic:'topics'}[kind];
    const videos=state.videos.filter(v=>Array.isArray(v[field])?v[field].includes(entityId):v[field]===entityId);
    openEvidence({id,label:entity.title||entity.name,videos:videos.map(v=>v.id),topics:kind==='topic'?[entityId]:[...new Set(videos.flatMap(v=>v.topics))]});
    if(kind==='person'&&entity.authored_channels?.length){
      const names=entity.authored_channels.map(id=>state.data.channels.find(c=>c.id===id)?.title).filter(Boolean);
      $('#evidenceNote').textContent=`Автор каналу: ${names.join(', ')}. У списку нижче — лише підтверджена участь у відео за поточними фільтрами.`;
    }
  }
  function openEvidence(selection){
    state.selection=selection;
    state.evidenceTopic=null;state.evidencePerson=null;state.evidenceLimit=['shared_topics','shared_people'].includes(selection.relation)?6:12;
    const byId=new Map(state.graphData.nodes.map(n=>[n.id,n.label]));
    $('#evidenceTitle').textContent=selection.label||`${byId.get(Core.idOf(selection.source))} ↔ ${byId.get(Core.idOf(selection.target))}`;
    $('#evidenceNote').textContent=selection.relation==='shared_people'?'Ті самі люди визначені учасниками відео обох каналів. Оберіть ім’я, щоб порівняти їхні виступи. Це не обов’язково спільний ефір чи співпраця каналів.':selection.relation==='shared_topics'?'Спільні теми не означають спільних виступів. Нижче — окремі відеоджерела кожної сторони.':'Відео, на яких ґрунтується цей зв’язок.';
    $('#evidenceEyebrow').textContent=selection.relation==='shared_people'?'КАНАЛИ · СПІЛЬНІ УЧАСНИКИ':selection.relation==='shared_topics'?'ТЕМАТИЧНИЙ ПЕРЕТИН':'ВІДЕОДЖЕРЕЛА';
    if(selection.relation==='channel_author'){
      $('#evidenceEyebrow').textContent='АВТОР КАНАЛУ';
      $('#evidenceNote').textContent='Авторство каналу підтверджено вручну. Участь у конкретних відео визначається окремо.';
    }
    renderEvidence();if(!$('#evidenceDialog').open)$('#evidenceDialog').showModal();
  }
  function renderEvidence(){
    // Selections already contain the exact filtered video IDs. Read those IDs
    // from the catalog so an overlap retains evidence from the other channel.
    const groups=Core.evidenceGroups(state.data,state.selection,state.data.videos,state.evidenceTopic,state.evidencePerson);
    const people=state.selection.relation==='shared_people'?(state.selection.people||[]):[];
    $('#evidencePeople').hidden=!people.length;
    $('#evidencePeople').innerHTML=people.length?`<h3>Хто поєднує ці канали</h3><div class="topic-chips"><button type="button" data-evidence-person="all" aria-pressed="${state.evidencePerson==null}" class="${state.evidencePerson==null?'active':''}">Усі учасники (${people.length})</button>${people.map(id=>`<button type="button" data-evidence-person="${id}" aria-pressed="${state.evidencePerson===id}" class="${state.evidencePerson===id?'active':''}">${esc(personName(id))}</button>`).join('')}</div>`:'';
    const topics=(state.selection.topics||[]).slice(0,30);
    $('#evidenceTopics').innerHTML=topics.length>1?`<button class="${state.evidenceTopic==null?'active':''}" data-evidence-topic="all" type="button">Усі теми</button>`+topics.map(id=>`<button class="${state.evidenceTopic===id?'active':''}" type="button" data-evidence-topic="${id}">${esc(topicName(id))}</button>`).join(''):'';
    $('#evidenceVideos').innerHTML=groups.map(group=>`${group.label?`<h3 class="evidence-side">${esc(group.label)} <span>${group.videos.length} відео</span></h3>`:''}${group.videos.slice(0,state.evidenceLimit).map(v=>videoCard(v,true)).join('')||`<p class="muted">${state.selection.relation==='channel_author'?'У вибраних відео участь автора поки не підтверджена.':'Відео за вибраними фільтрами не знайдено.'}</p>`}`).join('');
    const remaining=groups.reduce((sum,group)=>sum+Math.max(0,group.videos.length-state.evidenceLimit),0);
    $('#moreEvidence').hidden=remaining===0;$('#moreEvidence').textContent=`Показати ще (${remaining})`;
  }
  function playVideo(id,start=0){
    const video=state.data?.videos.find(v=>v.id===Number(id));if(!video||!/^[A-Za-z0-9_-]{11}$/.test(video.youtube_id))return;
    const seconds=Number.isFinite(Number(start))?Math.max(0,Math.floor(Number(start))):0;
    const frame=document.createElement('iframe');frame.title=video.title;frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
    const url=new URL(`https://www.youtube-nocookie.com/embed/${video.youtube_id}`);url.search=new URLSearchParams({autoplay:'1',playsinline:'1',rel:'0',start:String(seconds),origin:location.origin});frame.src=url.href;
    $('#playerContainer').replaceChildren(frame);$('#playerTitle').textContent=video.title;$('#playerExternal').href=`https://www.youtube.com/watch?v=${video.youtube_id}${seconds?'&t='+seconds+'s':''}`;
    music.setDucked(true).catch(()=>{});if(!$('#playerDialog').open)$('#playerDialog').showModal();
  }
  async function load(){
    $('#pageError').hidden=true;
    try{const response=await fetch('data/catalog.json',{cache:'no-cache'});if(!response.ok)throw new Error('catalog');const data=await response.json();if(data.schema!=='genealogy-public/v1')throw new Error('schema');state.data=data;
      state.discoveryIndex=Discovery.createIndex(data);
      $('#catalogStats').innerHTML=[[data.channels.length,'каналів'],[data.videos.length,'відео'],[data.people.length,'людей'],[data.topics.length,'тем']].map(([n,label])=>`<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join('');
      $('#categorySelect').innerHTML='<option value="all">Усі категорії</option>'+data.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
      $('#channelSelect').innerHTML='<option value="all">Усі канали</option>'+[...data.channels].sort((a,b)=>a.title.localeCompare(b.title,'uk')||a.id-b.id).map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
      if(state.channel!=='all'&&!data.channels.some(c=>String(c.id)===state.channel))state.channel='all';
      $('#channelSelect').value=state.channel;
      $('#ratingTopic').innerHTML='<option value="all">Усі теми</option>'+data.topics.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
      if(data.updated_at)$('#updatedAt').textContent=`Оновлено ${new Intl.DateTimeFormat('uk',{dateStyle:'long'}).format(new Date(data.updated_at))}`;
      changeView();
    }catch(_){$('#pageError').hidden=false;$('#graphMessage').textContent='Каталог тимчасово недоступний.';}
  }
  function initLocalAdminLink(){
    const link=$('#localAdminLink');
    if(!link || !['127.0.0.1','localhost','[::1]'].includes(location.hostname))return;
    if(!['http:','https:'].includes(location.protocol))return;
    link.href=location.port==='8001'?'/admin#controls':'http://127.0.0.1:8001/admin#controls';
    link.hidden=false;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    initLocalAdminLink();
    observeResponsiveLayout();
    initGraph();changeView();load();
    window.addEventListener('hashchange',changeView);
    $('#ratingEntity').addEventListener('change',()=>{state.page=0;renderCatalog();});
    $('#ratingTopic').addEventListener('change',()=>{state.page=0;renderCatalog();});
    document.addEventListener('click',e=>{const channel=e.target.closest('[data-rating-channel]');if(channel)openRatingChannel(channel.dataset.ratingChannel,channel.dataset.ratingSubject);const topic=e.target.closest('[data-rating-topic]');if(topic){$('#ratingTopic').value=topic.dataset.ratingTopic;state.page=0;renderCatalog();}const person=e.target.closest('[data-rating-person]');if(person)openRatingPerson(person.dataset.ratingPerson);});
    let searchTimer;$('#searchInput').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.search=e.target.value;refresh();},200);});
    $('#categorySelect').addEventListener('change',e=>{state.category=e.target.value;refresh();});
    $('#channelSelect').addEventListener('change',e=>{state.channel=e.target.value;refresh();});
    $('#resetFilters').addEventListener('click',()=>{clearTimeout(searchTimer);state.search='';state.category='all';state.channel='all';state.topicSelection=null;state.placeSelection=null;state.titleOnly=false;$('#titleOnlyFilter').checked=false;$('#searchInput').value='';$('#categorySelect').value='all';$('#channelSelect').value='all';refresh();});
    $('#topicPickerButton').addEventListener('click',()=>openDiscoveryPicker('topic'));
    $('#placePickerButton').addEventListener('click',()=>openDiscoveryPicker('place'));
    $('#showFilteredVideos').addEventListener('click',()=>{location.hash='videos';});
    $('#titleOnlyFilter').addEventListener('change',event=>{state.titleOnly=event.target.checked;refresh();});
    $('#discoveryQuery').addEventListener('input',()=>{state.pickerLimit=30;renderDiscoveryPicker();});
    $('#moreDiscoveryOptions').addEventListener('click',()=>{state.pickerLimit+=30;renderDiscoveryPicker();});
    document.addEventListener('click',event=>{
      const choice=event.target.closest('[data-discovery-kind]');if(choice)chooseDiscovery(choice.dataset.discoveryKind,choice.dataset.discoveryId);
      if(event.target.closest('[data-open-topic-picker]'))openDiscoveryPicker('topic');
      const clear=event.target.closest('[data-clear-discovery]');if(clear){state[clear.dataset.clearDiscovery==='place'?'placeSelection':'topicSelection']=null;refresh();}
    });
    $('#modeList').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b||!state.data)return;state.mode=b.dataset.mode;$$('[data-mode]').forEach(item=>{item.classList.toggle('active',item===b);item.setAttribute('aria-pressed',String(item===b));});$('#activeModeLabel').textContent=b.textContent.replace(/^\s*\d+\s*/,'');renderMap();setPanel('options',false);});
    $('#optionsToggle').addEventListener('click',()=>setPanel('options',$('#graphOptions').hidden));
    $('#connectionsToggle').addEventListener('click',()=>setPanel('connections',$('#connectionsPanel').hidden));
    $$('[data-close-panel]').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.closePanel,false)));
    $('#expandGraph').addEventListener('click',()=>setExpanded(!state.expanded));
    document.addEventListener('keydown',e=>{if(e.key!=='Escape'||$('dialog[open]'))return;if(!$('#graphOptions').hidden)setPanel('options',false);else if(!$('#connectionsPanel').hidden)setPanel('connections',false);else if(state.focusNode)clearNodeFocus();else if(state.expanded)setExpanded(false);});
    $('#densitySelect').addEventListener('change',()=>state.data&&renderMap());
    $('#connectionsList').addEventListener('click',e=>{const b=e.target.closest('[data-connection]');if(b)openEvidence(state.graphData.links[Number(b.dataset.connection)]);});
    $('#fitGraph').addEventListener('click',()=>clearNodeFocus());
    $('#clearNodeFocus').addEventListener('click',()=>clearNodeFocus());
    $('#showNodeVideos').addEventListener('click',()=>{if(state.focusNode)openEvidence(state.focusNode);});
    $('#showNodeConnections').addEventListener('click',()=>setPanel('connections',true));
    $('#motionToggle').addEventListener('click',()=>{state.paused=!state.paused;renderMotion();});
    $('#labelsToggle').addEventListener('click',toggleLabels);
    $('#labelMode').addEventListener('change',event=>setLabelMode(event.target.value));
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{state.paused=event.matches;renderMotion();});
    $$('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
    $('#aboutButton').addEventListener('click',()=>$('#aboutDialog').showModal());$('#retryData').addEventListener('click',load);
    $('#prevPage').addEventListener('click',()=>{state.page=Math.max(0,state.page-1);renderCatalog();$('#catalogView').scrollIntoView({block:'start'});});
    $('#nextPage').addEventListener('click',()=>{state.page++;renderCatalog();$('#catalogView').scrollIntoView({block:'start'});});
    document.addEventListener('click',e=>{const play=e.target.closest('[data-play]');if(play)playVideo(play.dataset.play,play.dataset.start);const entity=e.target.closest('[data-entity]');if(entity)openEntity(entity.dataset.entity);});
    $('#evidenceTopics').addEventListener('click',e=>{const b=e.target.closest('[data-evidence-topic]');if(!b)return;state.evidenceTopic=b.dataset.evidenceTopic==='all'?null:Number(b.dataset.evidenceTopic);state.evidenceLimit=12;renderEvidence();});
    $('#evidencePeople').addEventListener('click',e=>{const b=e.target.closest('[data-evidence-person]');if(!b)return;state.evidencePerson=b.dataset.evidencePerson==='all'?null:Number(b.dataset.evidencePerson);state.evidenceLimit=6;renderEvidence();$('#evidencePeople').querySelector(`[data-evidence-person="${state.evidencePerson??'all'}"]`)?.focus({preventScroll:true});});
    $('#moreEvidence').addEventListener('click',()=>{state.evidenceLimit+=12;renderEvidence();});
    $('#playerDialog').addEventListener('close',()=>{if(!$('#playerDialog').open){$('#playerContainer').replaceChildren();music.setDucked(false).catch(()=>{});}});
    $('#soundToggle').addEventListener('click',async()=>{try{const enabled=await music.toggle();$('#soundToggle').setAttribute('aria-pressed',String(enabled));$('#soundToggle').setAttribute('aria-label',enabled?'Вимкнути космічну музику':'Увімкнути космічну музику');$('#soundToggle span').textContent=enabled?'Космічний звук':'Звук вимкнено';$('#volumeControl').hidden=!enabled;}catch(_){$('#soundToggle span').textContent='Звук недоступний';}});
    $('#musicVolume').addEventListener('input',e=>music.setVolume(Number(e.target.value)/100));
    document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement)e.target.hidden=true;},true);
    document.addEventListener('visibilitychange',()=>{music.setHidden(document.hidden).catch(()=>{});if(!state.graph)return;renderMotion();if(!document.hidden&&!state.labelFrame)labels();});
    window.addEventListener('pagehide',event=>{music.dispose().catch(()=>{});if(event.persisted)state.dynamics?.setState({paused:state.paused,visible:false});else{state.dynamics?.dispose();state.avatars?.dispose();}});
    window.addEventListener('pageshow',event=>{if(event.persisted&&state.graph){renderMotion();labels();}});
    window.addEventListener('pageshow',e=>{if(e.persisted){$('#soundToggle').setAttribute('aria-pressed','false');$('#soundToggle').setAttribute('aria-label','Увімкнути космічну музику');$('#soundToggle span').textContent='Звук вимкнено';$('#volumeControl').hidden=true;}});
  });
})();
