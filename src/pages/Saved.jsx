import ArticleItem from "../components/ArticleItem";
import Skeleton from "../components/Skeleton";
import { useRadar } from "../lib/data";

export default function Saved() {
  const { loading, articles, topics } = useRadar();
  const saved = articles.filter((a) => a.saved);
  if (loading) return <div className="page"><Skeleton lines={5} tall /></div>;
  return (
    <div className="page saved">
      <div className="section-head">
        <h1 className="display display-md">שמורות</h1>
        <span className="mono muted">{saved.length} כתבות</span>
      </div>
      {saved.length === 0 ? (
        <div className="state"><p>עוד אין כתבות שמורות. כל כתבה אפשר לשמור מדף הנושא.</p></div>
      ) : (
        <ul className="articles">
          {saved.map((a, i) => {
            const t = topics.find((x) => x.id === a.topic_id);
            return <ArticleItem key={a.id} article={a} color={t?.color ?? "#999"} topicName={t?.keyword} index={i} />;
          })}
        </ul>
      )}
    </div>
  );
}
