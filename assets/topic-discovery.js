(function(root){
  'use strict';
  const norm=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('uk').replace(/[’ʼ`]/g,"'").replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const rule=source=>new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${source})`,'iu');
  const collections=[
    {id:'dna',name:'ДНК-генеалогія',hint:'Тести, генетичні збіги, гаплогрупи та пошук родичів',aliases:'днк dna фтдна генетична генетика гаплогрупи тести',pattern:rule('днк|dna(?:\\b)|гаплогруп|аутосом|мітохондрі|y[ -]хромосом|генетичн[а-яіїєґ]* (?:генеалог|збіг|тест|походжен)|family\\s*tree\\s*dna|ftdna|gedmatch|сантиморган|сентиморган|тріангуляц')},
    {id:'surnames',name:'Дослідження прізвищ',hint:'Походження, зміни, варіанти написання й поширення прізвищ',aliases:'прізвище прізвища прізвищ фамілія ономастика',pattern:rule('прізвищ|однофаміл|антропонім|ономастик')},
    {id:'migration',name:'Переселення та міграції',hint:'Переселення родин, еміграція, депортації та колоністи',aliases:'переселення переселенці міграція еміграція імміграція виселення депортація',pattern:rule('переселен|міграці|еміграці|імміграці|депортац|виселен|репатріац|колоніст|операці[яї] [«" ]*вісла'),exclude:/міграці[яї]\s+(?:даних|баз|сайт|сервер)/iu},
    {id:'metrics',name:'Метричні книги',hint:'Записи про народження, хрещення, шлюби й смерті',aliases:'метрики метрика метричні книги метричні записи народження шлюб смерть',pattern:rule('метрич|метрик(?:а|и|у|ами|ах)(?:$|[^\\p{L}])|актов[а-яіїєґ]* запис[а-яіїєґ]* (?:про )?(?:народжен|шлюб|смерт)')},
    {id:'confessions',name:'Сповідні розписи',hint:'Сповідки, парафіяльні списки та пошук родин у них',aliases:'сповідки сповідка сповідні розписи розпис',pattern:rule('сповідн[а-яіїєґ]* (?:розпис|відом|книг|документ|спис)|сповідк|исповедн'),exclude:/(?:^вірш|^поезі|вірш.{0,30}сповідн)/iu},
    {id:'revisions',name:'Ревізькі казки',hint:'Ревізії населення та родинні зв’язки в ревізьких списках',aliases:'ревізії ревізькі ревізські казки ревізька казка',pattern:rule('ревізьк|ревізськ|ревізійні списк|ревізі[яї] населен')},
    {id:'census',name:'Переписи населення',hint:'Переписи, посімейні та погосподарські списки',aliases:'перепис переписи населення посімейні погосподарські',pattern:rule('перепис(?:и|у|ів|ах|ом|ний|ні|ні листи| населення| 1897)|посімейн|погосподарськ')},
    {id:'archives',name:'Пошук в архівах',hint:'Пошук справ, робота з фондами, описами та запитами',aliases:'архів архіви фонди описи справи архівний пошук',pattern:rule('архівн[а-яіїєґ]* (?:пошук|справ|запит|фонд|опис|документ)|пошук (?:у |в )?архів|робот[а-яіїєґ]* (?:у |в |з )архів|описи фонд|архівознав')},
    {id:'digital',name:'Цифрові інструменти',hint:'FamilySearch, програми для родоводу, оцифрування та ШІ',aliases:'familysearch gramps gedcom штучний інтелект ші програми цифрові',pattern:rule('familysearch|gramps|gedcom|генеалогічн[а-яіїєґ]* програм|штучн[а-яіїєґ]* інтелект|ші[ -]агент|оцифруван|розпізнаван[а-яіїєґ]* (?:текст|рукопис)')},
    {id:'family-stories',name:'Родинні історії та інтерв’ю',hint:'Опитування родичів, сімейні перекази й домашні архіви',aliases:'родина родичі інтервю інтерв’ю сімейні перекази родинні історії',pattern:rule('опитуван[а-яіїєґ]* родич|сімейн[а-яіїєґ]* переказ|родинн[а-яіїєґ]* істор|історі[яї] родин|домашн[а-яіїєґ]* архів|усн[а-яіїєґ]* істор')}
  ];
  const placeTypes={country:'країна',historical_region:'історичний регіон',guberniya:'губернія',oblast:'область',district:'район / повіт',city:'місто',village:'село',unknown:'місцевість'};
  // These are exclusion cues, not a semantic classifier: show the actual basis
  // and keep title-only filtering available rather than claiming certainty.
  const incidental=/(?:підпиш|донат|партнерськ[а-яіїєґ]* посилан|рекламн[а-яіїєґ]* посилан|(?:опис|текст) містить (?:лише )?посилан|перелік посилан|не (?:обговорю|розгляда)|не йдеться|лише (?:побіжн[а-яіїєґ]* )?згад|згаду[а-яіїєґ]* побіжно|місце (?:проведення|запису)|зберігаються в архіві|архів розташован)/iu;
  function informative(text){return norm(text).length>=12&&!incidental.test(text);}
  function phraseTest(name){
    const words=norm(name).split(' ').filter(w=>w.length>2);
    return text=>{const value=norm(text);return words.length>0&&words.every(word=>{
      const stem=word.length>5?word.replace(/(?:ами|ями|ого|ому|ої|ою|ів|ий|ій|а|я|и|і|ь)$/u,''):word.replace(/ь$/u,'');
      // Ukrainian toponyms alternate vowels: Львів / Львова, Київ / Києва.
      // This check only runs for topics/places already assigned to this video.
      const variants=[stem,word.replace(/ів$/u,'ов'),word.replace(/їв$/u,'єв')];
      return value.split(' ').some(token=>variants.some(part=>token.startsWith(part)));
    });};
  }
  function detail(video,test,proof,assigned=false){
    if(test(String(video.title||'').replace(/#[\p{L}\p{N}_]+/gu,'')))return {score:5,basis:'title',text:video.title,at:null};
    const sentence=String(video.summary||'').split(/(?<=[.!?])\s+/u).find(s=>informative(s)&&test(s));
    if(sentence)return {score:4,basis:video.basis==='captions'?'captions':'description',text:sentence.slice(0,340),at:null};
    if(assigned&&informative(proof?.text))return {score:3,basis:video.basis==='captions'?'captions':'description',text:proof.text,at:proof.at??null};
    return null;
  }
  function createIndex(data){
    const entries=new Map(),topics=new Map(data.topics.map(t=>[t.id,t]));
    const key=(kind,id)=>`${kind}:${id}`;
    const add=(kind,item)=>{const entry={...item,kind,matches:new Map()};entries.set(key(kind,item.id),entry);return entry;};
    collections.forEach(c=>add('collection',c));
    data.topics.forEach(t=>add('topic',{...t,hint:'Вузька тема',test:phraseTest(t.name)}));
    (data.places||[]).filter(p=>p.type!=='archive_location').forEach(p=>add('place',{...p,hint:placeTypes[p.type]||'місцевість',test:phraseTest(p.name)}));
    for(const video of data.videos){
      const proofs=new Map((video.evidence||[]).map(e=>[e.id,e]));
      const assignedTopics=(video.topics||[]).map(id=>topics.get(id)).filter(Boolean);
      for(const topic of assignedTopics){
        const entry=entries.get(key('topic',topic.id));
        const match=detail(video,entry.test,proofs.get(`topic_${topic.id}`),true);
        if(match)entry.matches.set(video.id,{...match,label:topic.name,topicId:topic.id});
      }
      for(const id of video.places||[]){
        const entry=entries.get(key('place',id));if(!entry)continue;
        const match=detail(video,entry.test,proofs.get(`place_${id}`),true);
        if(match)entry.matches.set(video.id,{...match,label:entry.name,placeId:id});
      }
      for(const collection of collections){
        if(collection.exclude?.test(video.title||''))continue;
        const test=text=>collection.pattern.test(text||'')&&!(collection.exclude?.test(text||''));
        let best=detail(video,test,null);
        for(const topic of assignedTopics.filter(t=>test(t.name))){
          const match=detail(video,test,proofs.get(`topic_${topic.id}`),true);
          if(match&&(!best||match.score>best.score))best={...match,topicId:topic.id};
        }
        if(best)entries.get(key('collection',collection.id)).matches.set(video.id,{...best,label:collection.name});
      }
    }
    function get(selection){return selection?entries.get(key(selection.kind,selection.id)):null;}
    function select({topic=null,place=null,titleOnly=false}={},videos=data.videos){
      if(!topic&&!place)return null;
      const selected=[topic,place].filter(Boolean).map(get);
      if(selected.some(e=>!e))return new Map();
      const results=new Map();
      for(const video of videos){
        const reasons=selected.map(e=>e.matches.get(video.id));
        if(reasons.every(r=>r&&(!titleOnly||r.basis==='title')))results.set(video.id,{score:reasons.reduce((sum,r)=>sum+r.score,0),reasons});
      }
      return results;
    }
    function options(kind,{query='',videoIds=null,titleOnly=false}={}){
      const tokens=norm(query).split(' ').filter(Boolean);
      return [...entries.values()].filter(e=>kind==='place'?e.kind==='place':e.kind!=='place').map(e=>{
        const count=[...e.matches].filter(([id,r])=>(!videoIds||videoIds.has(id))&&(!titleOnly||r.basis==='title')).length;
        return {...e,count};
      }).filter(e=>e.count&&tokens.every(t=>norm(`${e.name} ${e.aliases||''}`).includes(t))).sort((a,b)=>
        Number(b.kind==='collection')-Number(a.kind==='collection')||b.count-a.count||a.name.localeCompare(b.name,'uk')||String(a.id).localeCompare(String(b.id)));
    }
    return {get,select,options};
  }
  const api={createIndex,collections:collections.map(({id,name,hint,aliases})=>({id,name,hint,aliases})),placeTypes};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.TopicDiscovery=api;
})(typeof window!=='undefined'?window:globalThis);
