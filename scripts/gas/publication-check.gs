/** 운영 데이터는 읽기만 한다. 편집기에서 수동 실행; 웹 요청에는 노출하지 않는다. */
function publicationDiagnostics() {
  publishedCache_ = null;
  const all = publicationList_(true);
  const visible = publicationList_(false);
  const managed = all.filter(function(it) { return !!it.publication; });
  const drafts = managed.filter(function(it) { return !it.publication.publishedAt; });
  const hidden = drafts.every(function(it) { return !visible.some(function(v) { return v.id === it.id; }) && publicationItem_(getItem(it.id),false) === null; });
  const legacy = all.filter(function(it) { return !it.publication; });
  const preserved = legacy.every(function(it) { return visible.some(function(v) { return v.id === it.id && v.date === it.date && v.name === it.name; }); });
  console.log(JSON.stringify({all:all.length,public:visible.length,managed:managed.length,unpublished:drafts.length,unpublishedHidden:hidden,legacyUnchanged:preserved,drafts:drafts.map(function(it) {return {id:it.id,name:it.name};})}));
  if (!hidden || !preserved) throw new Error('publication invariant failed');
}
