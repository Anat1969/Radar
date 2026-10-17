import { motion } from "framer-motion";
import { useRadar } from "../lib/data";
import { timeAgo } from "../lib/util";

// Older rows kept Google's HTML snippet, which only repeats the title and source.
function cleanDescription(article) {
  const text = (article.description || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return !text || text.startsWith(article.title) ? null : text;
}

export default function ArticleItem({ article, color, topicName, index = 0, highlight = false }) {
  const { toggleSaved, notify } = useRadar();
  const share = async () => {
    const data = { title: article.title, url: article.url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(`${article.title}\n${article.url}`);
        notify("הכתבה הועתקה לשיתוף", "ok");
      }
    } catch { /* user cancelled */ }
  };
  return (
    <motion.li
      id={`a-${article.id}`}
      className={`article${highlight ? " is-highlight" : ""}`}
      style={{ "--c": color }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.035 }}
    >
      <div className="article-meta mono">
        {topicName && <span style={{ color }}>{topicName}</span>}
        <span>{article.source || "מקור לא ידוע"}</span>
        <span>{timeAgo(article.published_at)}</span>
        {article.saved && <span className="saved-mark">שמורה</span>}
      </div>
      <a className="article-title" href={article.url} target="_blank" rel="noreferrer">{article.title}</a>
      {cleanDescription(article) && <p className="article-desc">{cleanDescription(article)}</p>}
      <div className="row-btns">
        <button className="btn btn-small btn-ghost" onClick={() => toggleSaved(article)}>
          {article.saved ? "הסרה מהשמורות" : "שמירת כתבה"}
        </button>
        <a className="btn btn-small btn-ghost" href={article.url} target="_blank" rel="noreferrer">פתיחת המקור</a>
        <button className="btn btn-small btn-ghost" onClick={share}>שיתוף</button>
      </div>
    </motion.li>
  );
}
