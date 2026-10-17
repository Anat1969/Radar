import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page state">
      <div className="mono eyebrow">404</div>
      <h1 className="display display-md">אין כאן אות.</h1>
      <Link className="btn btn-primary" to="/">חזרה לרדאר</Link>
    </div>
  );
}
