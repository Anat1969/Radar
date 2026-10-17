# רדאר (RADAR-GH)

מעקב אישי אחרי נושאים בחדשות בעברית, עם תקציר יומי של Claude. גרסה משודרגת של פרויקט Lovable "RADAR AKTUALYA Connect".

כתובת: https://radar-aktualya.vercel.app (פרויקט Vercel radar-aktualya. מיזוג ל-main מעדכן אותה).

## החלטות קבועות של ענת
- בלי התחברות, בלי הרשאות משתמש ובלי אישורים. כל מי שפותח את האפליקציה יכול לערוך.
- הנתונים בפרויקט Supabase בשם cultura-GH (ktqmwpbzcnzkhjskqisy). הפרויקט משותף, ולכן כל טבלה מתחילה ב-radar_. אין תלות בפרויקט RADAR-AKTUALYA הישן או ב-Lovable Cloud.
- מיזוג ל-main אחרי בדיקה ירוקה, בלי לשאול. ענת אישרה מיזוג קבוע.
- עברית ו-RTL, בלי אייקונים. סרגל עליון קבוע בכל הדפים: שם האפליקציה מקשר לדף הבית, "העתקת קישור", "שיחת הפיתוח" ו"התקנת האפליקציה".

## מבנה
- `src/`: Vite, React ו-framer-motion. הדפים הם רדאר (/), נושא (/topic/:id?tab=), תדריך (/briefing?i=), ארכיון (/archive?topic=&date=), שמורות ונושאים והגדרות.
- `supabase/functions/radar-scan`: מושך Google News RSS בעברית (בלי מפתח), ו-Claude (`ANTHROPIC_API_KEY`, `claude-sonnet-5-5`) מסמן רלוונטיות וכותב את התקציר. יש הגבלה: סריקה אחת לנושא כל 5 דקות, ועד 60 סריקות בשעה.
- pg_cron `radar-auto-scan` רץ כל שעה, והפונקציה סורקת רק בשעה שנקבעה ב-radar_settings.scan_hour (שעון ישראל).
- `supabase/migrations/`: הסכמה. היא הוחלה דרך כלי ה-MCP.

## בדיקה
- `npm run build && npm test`: Playwright מול vite preview, עם מוקים ל-Supabase. הבדיקה לוחצת על כל כפתור, בודקת גלילה אופקית בנייד ואת יכולת ההתקנה.

## מלכודות
- Google News מחזיר הרבה כתבות לא קשורות (מילים מתפריטים ומתגיות באתר). לכן Claude מסמן `relevant` והממשק מסנן `relevant === false`.
- בכלי ה-SQL של ה-MCP, פקודות UPDATE ו-DELETE נתקעות עד שענת מאשרת. שינויי נתונים עוברים דרך פונקציית ה-Edge או דרך הממשק.
