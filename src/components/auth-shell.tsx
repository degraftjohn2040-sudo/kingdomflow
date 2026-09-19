import { Brand } from './brand';
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">YOUR MINISTRY, CONNECTED</span>
          <h1>
            More time for people.
            <br />
            <em>More room to grow.</em>
          </h1>
          <p>Members. Ministry. Growth. One Platform.</p>
          <div className="story-rule" />
          <p className="story-small">
            A thoughtful home for your ministry’s everyday work—from the first welcome to a lifetime
            of belonging.
          </p>
        </div>
        <small>Built for churches, fellowships, and ministries.</small>
      </section>
      <section className="auth-content">
        <div className="auth-box">
          <span className="eyebrow">WELCOME TO KINGDOMFLOW</span>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
