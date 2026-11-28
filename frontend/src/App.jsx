
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Page, { NotifBell, notes0 } from './Pages.jsx';
import Auth from './Auth.jsx';
import ProfilePage from './ProfilePage.jsx';
import Network from './Network.jsx';

import {
  api,
  getToken,
  setToken,
  disconnectSocket,
  connectSocket,
  getSocket
} from './lib/api.js';

import {
  Home, Compass, Users, MessageCircle, Bell, CalendarDays, BriefcaseBusiness,
  GraduationCap, UsersRound, Bookmark, Settings, Search, Plus, Image as ImageIcon,
  Video, Smile, MoreHorizontal, Heart, MessageSquare, Share2, Send, ChevronDown,
  CheckCircle2, MapPin, Clock3, ArrowUpRight, Sparkles, Menu, X, Hash, TrendingUp,
  CalendarCheck, Camera, FileText, LogOut, UserRound, SlidersHorizontal, Edit3, Lock, AtSign,
  Link2, Briefcase, Award, Github, Linkedin, Mail, PlusCircle, ExternalLink, BookOpen,
  ChevronRight, UserPlus, GraduationCap as GradIcon
} from 'lucide-react';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const avatar = id => `https://i.pravatar.cc/100?img=${id}`;

const subtitle = u =>
  !u ? '' : u.headline || (u.role === 'alumni' ? 'Alumni' : (u.department || 'Student')) + ' · DIU';

const ago = d => {
  if (!d) return 'Just now';

  const s = (Date.now() - new Date(d).getTime()) / 1000;

  if (!Number.isFinite(s)) return 'Just now';
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;

  return `${Math.floor(s / 86400)} d ago`;
};

const mapPost = p => ({
  id: p.id,
  authorId: p.author?.id,
  name: p.club ? p.club.name : (p.author?.name || 'DIU Member'),
  role: subtitle(p.author),
  time: ago(p.createdAt),
  avatar: p.club ? p.club.imageUrl : p.author?.avatarUrl,
  verified: true,
  label: p.club ? 'Club announcement' : undefined,
  text: p.content || '',
  tags: p.tags || [],
  image: p.imageUrl,
  imageAlt: 'Post image',
  likes: Number(p.counts?.reactions || 0),
  comments: Number(p.counts?.comments || 0),
  shares: Number(p.counts?.shares || 0),
  liked: !!p.liked,
  saved: !!p.saved
});

const postsSeed = [
  {
    id: 1,
    name: 'Nusrat Jahan',
    role: 'CSE · Department of Computer Science',
    time: '18 min ago',
    avatar: avatar(47),
    verified: true,
    text: 'Our team just completed the first prototype of an accessible campus navigation app! Looking for 2 more people who love UI/UX and React to join us for the next sprint. 🚀',
    tags: ['#DIUCSE', '#BuildInPublic', '#TeamUp'],
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85',
    imageAlt: 'Students collaborating around a laptop',
    likes: 84,
    comments: 12,
    shares: 6,
    liked: false
  },
  {
    id: 2,
    name: 'DIU Robotics Club',
    role: 'Official club community',
    time: '1 hr ago',
    avatar: avatar(12),
    verified: true,
    label: 'Club announcement',
    text: 'Registrations are open for RoboSprint 2026! Join workshops, meet fellow makers, and compete with your team. Open to all DIU students — no previous robotics experience required.',
    tags: ['#RoboSprint2026', '#DIUClubs'],
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=85',
    imageAlt: 'Robotics technology',
    likes: 126,
    comments: 28,
    shares: 19,
    liked: true
  },
  {
    id: 3,
    name: 'Tanvir Ahmed',
    role: 'Alumni · Software Engineer at Brain Station 23',
    time: '3 hrs ago',
    avatar: avatar(13),
    verified: true,
    text: 'A small reminder for juniors: your GitHub is your living portfolio. Keep your projects readable, write useful READMEs, and show what you learned — not just what you built. Happy to review a few student portfolios this weekend.',
    tags: ['#AlumniAdvice', '#CareerGrowth'],
    likes: 203,
    comments: 31,
    shares: 42,
    liked: false
  }
];

const navItems = [
  { label: 'Home', icon: Home },
  { label: 'Explore', icon: Compass },
  { label: 'My Network', icon: Users }
];

const communityItems = [
  { label: 'Clubs & Communities', icon: UsersRound },
  { label: 'Campus Events', icon: CalendarDays },
  { label: 'Jobs & Internships', icon: BriefcaseBusiness },
  { label: 'Alumni Connect', icon: GraduationCap },
  { label: 'Saved Posts', icon: Bookmark }
];

function Avatar({ src, size = 'md', online = false }) {
  return (
    <span className={`avatar avatar-${size}`}>
      {src ? <img src={src} alt="" /> : <UserRound size={18} />}
      {online && <i />}
    </span>
  );
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <span>D</span>
        <i />
      </div>
      <span className="brand-name">DIU<span>Link</span></span>
    </div>
  );
}

function Sidebar({
  active,
  setActive,
  mobileOpen,
  setMobileOpen,
  onViewProfile,
  me,
  stats
}) {
  const handle = label => {
    setActive(label);
    setMobileOpen(false);
  };

  return (
    <>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <button
          className="profile-mini profile-mini-button"
          onClick={onViewProfile}
          aria-label="View your profile"
        >
          <div className="profile-cover" />
          <Avatar src={me.avatarUrl} size="lg" online />

          <div className="profile-mini-copy">
            <strong>{me.name}</strong>
            <span>{subtitle(me)}</span>
          </div>

          <span className="verified-mini">
            <CheckCircle2 size={13} />
          </span>

          <div className="profile-stats">
            <div>
              <b>{stats.connections}</b>
              <span>Connections</span>
            </div>
            <div>
              <b>{stats.posts}</b>
              <span>Posts</span>
            </div>
            <div>
              <b>{stats.projects}</b>
              <span>Projects</span>
            </div>
          </div>
        </button>

        <div className="side-label">Menu</div>

        <nav className="nav-list">
          {navItems.map(({ label, icon: Icon, count }) => (
            <button
              key={label}
              className={`nav-item ${active === label ? 'active' : ''}`}
              onClick={() => handle(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {count && <em>{count}</em>}
            </button>
          ))}
        </nav>

        <div className="side-divider" />
        <div className="side-label">Your campus</div>

        <nav className="nav-list">
          {communityItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${active === label ? 'active' : ''}`}
              onClick={() => handle(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => handle('Settings')}>
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="diu-note">
            <span className="diu-note-icon">
              <GraduationCap size={18} />
            </span>
            <div>
              <b>DIU community</b>
              <span>Connected by campus.</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Header({
  query,
  setQuery,
  setMobileOpen,
  onViewProfile,
  onSignOut,
  go,
  notes,
  setNotes,
  msgs,
  role,
  me
}) {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <header className="topbar">
      <button
        className="icon-button menu-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={21} />
      </button>

      <div className="mobile-brand">
        <Brand />
      </div>

      <label className="searchbox">
        <Search size={18} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search people, posts, clubs, opportunities..."
        />
      </label>

      <div className="top-actions">
        <button className="top-icon" aria-label="Create">
          <Plus size={19} />
        </button>

        <button className="top-icon" aria-label="Messages" onClick={() => go('Messages')}>
          <MessageCircle size={19} />
          {msgs > 0 && <b className="badge">{msgs}</b>}
        </button>

        <NotifBell notes={notes} setNotes={setNotes} go={go} />

        <div className="profile-menu-wrap">
          <button
            className="profile-trigger"
            onClick={() => setShowProfile(!showProfile)}
          >
            <Avatar src={me.avatarUrl} />
            <ChevronDown size={15} />
          </button>

          {showProfile && (
            <div className="profile-dropdown">
              <b>
                {me.name}
                <small className="role-chip">{role}</small>
              </b>

              <button
                onClick={() => {
                  onViewProfile();
                  setShowProfile(false);
                }}
              >
                <UserRound size={15} /> View your profile
              </button>

              <hr />

              <button>
                <Settings size={15} /> Account settings
              </button>

              <button onClick={onSignOut}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Composer({ onPost, me }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('Post');

  const submit = async () => {
    if (!text.trim()) return;

    const ok = await onPost(text.trim(), mode);

    if (ok) {
      setText('');
      setMode('Post');
    }
  };

  return (
    <section className="composer card">
      <div className="composer-top">
        <Avatar src={me.avatarUrl} size="lg" />

        <div className="composer-input-wrap">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="What’s happening on campus?"
            rows={2}
          />
        </div>
      </div>

      <div className="composer-bottom">
        <div className="composer-tools">
          <button
            onClick={() => setMode('Photo')}
            className={mode === 'Photo' ? 'tool-selected' : ''}
          >
            <ImageIcon size={17} /> Photo
          </button>

          <button
            onClick={() => setMode('Project')}
            className={mode === 'Project' ? 'tool-selected' : ''}
          >
            <FileText size={17} /> Project
          </button>

          <button
            onClick={() => setMode('Event')}
            className={mode === 'Event' ? 'tool-selected' : ''}
          >
            <CalendarDays size={17} /> Event
          </button>

          <button className="emoji-tool" title="Add feeling">
            <Smile size={17} />
          </button>
        </div>

        <button
          className="btn-primary post-btn"
          onClick={submit}
          disabled={!text.trim()}
        >
          Post
        </button>
      </div>

      {mode !== 'Post' && (
        <div className="composer-hint">
          <Sparkles size={14} />
          {mode} post selected — add your details in the text above.
        </div>
      )}
    </section>
  );
}

/* ---------------- POST CARD + COMMENTS + SHARE ---------------- */

function PostCard({
  post,
  onLike,
  onSave,
  onSend,
  onShare,
  onOpen,
  meAvatar,
  socket
}) {
  const [cm, setCm] = useState('');
  const [comments, setComments] = useState([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [sending, setSending] = useState(false);

  // Share states
  const [shareOpen, setShareOpen] = useState(false);
  const [shareComment, setShareComment] = useState('');
  const [sharing, setSharing] = useState(false);

  // Real-time comment update for this post.
  useEffect(() => {
    if (!socket) return;

    const handleFeedRefresh = payload => {
      if (
        payload?.type === 'comment' &&
        Number(payload.postId) === Number(post.id) &&
        commentsOpen
      ) {
        api.posts.comments(post.id)
          .then(result => {
            const items = Array.isArray(result?.items)
              ? result.items
              : [];

            setComments(items);
            setCommentsLoaded(true);
          })
          .catch(error => {
            console.error('Could not refresh comments:', error);
          });
      }
    };

    socket.on('feed:refresh', handleFeedRefresh);

    return () => {
      socket.off('feed:refresh', handleFeedRefresh);
    };
  }, [socket, post.id, commentsOpen]);

  const toggleComments = async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);

    if (next && !commentsLoaded) {
      setCommentsLoading(true);

      try {
        const result = await api.posts.comments(post.id);

        setComments(
          Array.isArray(result?.items) ? result.items : []
        );

        setCommentsLoaded(true);
      } catch (error) {
        alert(error.message || 'Comments could not be loaded.');
      } finally {
        setCommentsLoading(false);
      }
    }
  };

  const sendCm = async () => {
    const content = cm.trim();

    if (!content || sending) return;

    setSending(true);

    try {
      const created = await onSend(post.id, content);

      if (created) {
        setComments(current => {
          const exists = current.some(
            item => Number(item.id) === Number(created.id)
          );

          return exists ? current : [...current, created];
        });

        setCommentsLoaded(true);
        setCm('');
        setCommentsOpen(true);
      }
    } finally {
      setSending(false);
    }
  };

  // Share post with optional comment.
  const handleShare = async () => {
    if (sharing || typeof onShare !== 'function') return;

    setSharing(true);

    try {
      const success = await onShare(
        post.id,
        shareComment.trim()
      );

      if (success) {
        setShareComment('');
        setShareOpen(false);
      }
    } catch (error) {
      console.error('Share failed:', error);
      alert(error.message || 'Post could not be shared.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <article className="post-card card">
      {post.label && (
        <div className="post-label">
          <span />
          {post.label}
        </div>
      )}

      <div className="post-head">
        <Avatar src={post.avatar} size="lg" />

        <div className="post-author">
          <div className="author-line">
            <strong
              style={{ cursor: post.authorId ? 'pointer' : undefined }}
              onClick={() => post.authorId && onOpen?.(post.authorId)}
            >
              {post.name}
            </strong>

            {post.verified && (
              <CheckCircle2 className="verified" size={14} />
            )}
          </div>

          <span>{post.role}</span>

          <small>
            {post.time} · <span className="globe">◉</span>
          </small>
        </div>

        <button className="icon-button more-button" aria-label="More options">
          <MoreHorizontal size={21} />
        </button>
      </div>

      <p className="post-text">{post.text}</p>

      {post.tags?.length > 0 && (
        <div className="post-tags">
          {post.tags.map(tag => (
            <a
              href="#"
              key={tag}
              onClick={e => e.preventDefault()}
            >
              {tag}
            </a>
          ))}
        </div>
      )}

      {post.image && (
        <div className="post-image">
          <img
            src={post.image}
            alt={post.imageAlt || 'Post image'}
          />
        </div>
      )}

      <div className="post-metrics">
        <span>
          <span className="reaction-dots">♥</span>
          {' '}{post.likes} reactions
        </span>

        <span>
          {post.comments} comments · {post.shares} shares
        </span>
      </div>

      <div className="post-actions">
        <button
          className={post.liked ? 'is-liked' : ''}
          onClick={() => onLike(post.id)}
        >
          <Heart
            size={18}
            fill={post.liked ? 'currentColor' : 'none'}
          />
          Like
        </button>

        <button onClick={toggleComments}>
          <MessageSquare size={18} />
          Comment
        </button>

        <button
          onClick={() => setShareOpen(value => !value)}
          disabled={sharing}
          aria-expanded={shareOpen}
        >
          <Share2 size={18} />
          Share
        </button>

        <button
          className={`save-action ${post.saved ? 'is-liked' : ''}`}
          title={post.saved ? 'Remove from saved' : 'Save post'}
          aria-pressed={!!post.saved}
          onClick={() => onSave(post.id)}
        >
          <Bookmark
            size={18}
            fill={post.saved ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      {shareOpen && (
        <div className="comments-panel share-panel">
          <div style={{ marginBottom: 10 }}>
            <strong>Share this post</strong>
            <p style={{ margin: '5px 0', color: 'var(--muted, #667)' }}>
              Add your thoughts before sharing (optional).
            </p>
          </div>

          <textarea
            value={shareComment}
            onChange={e => setShareComment(e.target.value)}
            placeholder="Write something about this post..."
            rows={3}
            disabled={sharing}
            style={{
              width: '100%',
              resize: 'vertical',
              padding: 12,
              borderRadius: 10,
              border: '1px solid var(--border, #ddd)',
              font: 'inherit',
              boxSizing: 'border-box'
            }}
          />

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 10
          }}>
            <button
              type="button"
              onClick={() => {
                setShareOpen(false);
                setShareComment('');
              }}
              disabled={sharing}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={handleShare}
              disabled={sharing}
            >
              <Share2 size={15} />
              {sharing ? 'Sharing...' : 'Share now'}
            </button>
          </div>
        </div>
      )}

      {commentsOpen && (
        <div className="comments-panel">
          {commentsLoading && (
            <p className="comments-status">Loading comments...</p>
          )}

          {!commentsLoading && comments.length === 0 && (
            <p className="comments-status">
              No comments yet. Be the first to comment.
            </p>
          )}

          {comments.map(comment => (
            <div className="comment-item" key={comment.id}>
              <Avatar src={comment.author?.avatarUrl} />

              <div className="comment-bubble">
                <strong>
                  {comment.author?.name || 'DIU Member'}
                </strong>

                <p>{comment.content}</p>

                <small>
                  {comment.createdAt
                    ? ago(comment.createdAt)
                    : 'Just now'}
                </small>
              </div>
            </div>
          ))}

          <div className="comment-entry">
            <Avatar src={meAvatar} />

            <input
              value={cm}
              onChange={e => setCm(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') sendCm();
              }}
              placeholder="Write a thoughtful comment..."
            />

            <button
              aria-label="Send comment"
              disabled={!cm.trim() || sending}
              onClick={sendCm}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/* ---------------- STORIES ---------------- */

function Stories() {
  const stories = [
    { name: 'Your story', img: avatar(32), add: true },
    { name: 'CSE Society', img: avatar(12) },
    { name: 'Nabila', img: avatar(44) },
    { name: 'DIU Career', img: avatar(15) },
    { name: 'Rafi', img: avatar(60) }
  ];

  return (
    <section className="stories card">
      <div className="section-heading">
        <div>
          <h3>Campus circles</h3>
          <p>Little updates from your community</p>
        </div>

        <button className="text-link">See all</button>
      </div>

      <div className="story-row">
        {stories.map(s => (
          <button className="story" key={s.name}>
            <span className={`story-ring ${s.add ? 'story-add' : ''}`}>
              <Avatar src={s.img} size="story" />
              {s.add && <i>+</i>}
            </span>

            <span>{s.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------------- RIGHT SIDEBAR ---------------- */

function RightRail({ people, onConnect, onOpen }) {
  return (
    <aside className="right-rail">
      <section className="right-card card">
        <div className="section-heading">
          <div>
            <h3>Trending on campus</h3>
            <p>What DIU is talking about</p>
          </div>

          <TrendingUp size={18} className="muted-icon" />
        </div>

        {[
          ['#DIUInnovationWeek', '1.2k posts', 'Technology'],
          ['#CSEFest2026', '864 posts', 'Campus life'],
          ['#InternshipDiaries', '532 posts', 'Career'],
          ['#DIUPhotography', '319 posts', 'Creative']
        ].map(t => (
          <button className="trend-item" key={t[0]}>
            <span className="trend-number">
              <Hash size={15} />
            </span>

            <span className="trend-copy">
              <b>{t[0]}</b>
              <small>{t[1]} · {t[2]}</small>
            </span>

            <ArrowUpRight size={15} />
          </button>
        ))}

        <button className="see-more">
          Explore trending <ArrowUpRight size={14} />
        </button>
      </section>

      <section className="right-card card">
        <div className="section-heading">
          <div>
            <h3>Upcoming events</h3>
            <p>Make your campus days count</p>
          </div>

          <button className="text-link">View all</button>
        </div>

        <EventMini
          day="24"
          month="NOV"
          title="DIU Tech Carnival"
          meta="10:00 AM · Main Auditorium"
          tone="blue"
        />

        <EventMini
          day="27"
          month="NOV"
          title="Design Meetup Vol. 3"
          meta="2:30 PM · Innovation Lab"
          tone="green"
        />

        <EventMini
          day="02"
          month="DEC"
          title="Career Connect 2026"
          meta="11:00 AM · DSC Campus"
          tone="orange"
        />
      </section>

      <section className="right-card card people-card">
        <div className="section-heading">
          <div>
            <h3>People you may know</h3>
            <p>Grow your DIU network</p>
          </div>

          <button className="text-link">See all</button>
        </div>

        {people.length ? (
          people.map(x => (
            <PersonMini
              key={x.id}
              img={x.avatarUrl}
              name={x.name}
              detail={subtitle(x)}
              onConnect={() => onConnect(x.id)}
              onOpen={() => onOpen(x.id)}
            />
          ))
        ) : (
          <p
            className="empty-note"
            style={{
              padding: '6px 2px',
              color: 'var(--muted, #667)'
            }}
          >
            No suggestions yet. Ask your classmates to join DIULink!
          </p>
        )}
      </section>

      <footer className="rail-footer">
        <div>
          <a href="#">About</a>
          <a href="#">Guidelines</a>
          <a href="#">Privacy</a>
          <a href="#">Help</a>
        </div>

        <span>© 2026 DIULink · Built for the DIU community</span>
      </footer>
    </aside>
  );
}

function EventMini({ day, month, title, meta, tone }) {
  return (
    <div className="event-mini">
      <div className={`event-date ${tone}`}>
        <b>{day}</b>
        <span>{month}</span>
      </div>

      <div className="event-copy">
        <b>{title}</b>
        <span>
          <Clock3 size={12} /> {meta}
        </span>
      </div>

      <button
        className="event-arrow"
        aria-label={`View ${title}`}
      >
        <ArrowUpRight size={16} />
      </button>
    </div>
  );
}

function PersonMini({ img, name, detail, onConnect, onOpen }) {
  const [sent, setSent] = useState(false);

  return (
    <div className="person-mini">
      <Avatar src={img} />

      <div style={{ cursor: 'pointer' }} onClick={onOpen}>
        <b>{name}</b>
        <span>{detail}</span>
      </div>

      <button
        className={sent ? 'following' : ''}
        disabled={sent}
        onClick={() => {
          setSent(true);
          onConnect?.();
        }}
      >
        {sent ? 'Requested' : 'Connect'}
      </button>
    </div>
  );
}

function EmptyState({ active }) {
  return (
    <div className="empty-state card">
      <div className="empty-icon">
        <Sparkles size={25} />
      </div>

      <h2>{active}</h2>

      <p>
        This space is ready for the next part of your DIULink experience.
        Choose Home to return to your campus feed.
      </p>
    </div>
  );
}

/* ---------------- MAIN APP ---------------- */

export default function App() {
  const [active, setActive] = useState('Home');
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState(notes0);
  const [msgs, setMsgs] = useState(0);

  const [booting, setBooting] = useState(!!getToken());
  const [profileId, setProfileId] = useState(null);

  const [stats, setStats] = useState({
    connections: 0,
    posts: 0,
    projects: 0
  });

  const [people, setPeople] = useState([]);
  const [feedTab, setFeedTab] = useState('forYou');
  const [feedErr, setFeedErr] = useState('');
  const feedRequestId = useRef(0);

  const [socket, setSocket] = useState(null);

  /* ---------------- AUTHENTICATION ---------------- */

  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }

    api.auth.me()
      .then(r => setUser(r.user))
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    const out = () => {
      disconnectSocket();
      setSocket(null);
      setUser(null);
      setPosts([]);
      setProfileId(null);
      setActive('Home');
    };

    window.addEventListener('diulink:logout', out);

    return () => {
      window.removeEventListener('diulink:logout', out);
    };
  }, []);

  /* ---------------- SOCKET CONNECTION ---------------- */

  useEffect(() => {
    if (!user?.id) {
      setSocket(null);
      return;
    }

    const currentSocket = connectSocket() || getSocket();

    if (currentSocket) {
      setSocket(currentSocket);
    }
  }, [user?.id]);

  /* ---------------- SIDEBAR DATA ---------------- */

  const loadSide = () => {
    if (!user?.id) return;

    api.users.get(user.id)
      .then(r => {
        if (r.profile?.counts) {
          setStats(r.profile.counts);
        }
      })
      .catch(() => {});

    api.users.suggestions()
      .then(r => setPeople(r.items || []))
      .catch(() => {});
  };

  /* ---------------- FEED LOADING ---------------- */

  const loadFeed = async (tab = feedTab) => {
    if (!user?.id) return;

    const requestId = ++feedRequestId.current;

    try {
      const result = await api.posts.feed({ tab });

      if (requestId !== feedRequestId.current) return;

      const items = Array.isArray(result?.items)
        ? result.items
        : [];

      setPosts(items.map(mapPost));
      setFeedErr('');
    } catch (error) {
      if (requestId !== feedRequestId.current) return;

      console.error('Feed loading failed:', error);
      setFeedErr(error.message || 'Could not load the feed.');
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadFeed(feedTab);
    }

    return () => {
      feedRequestId.current += 1;
    };
  }, [user?.id, feedTab]);

  /* ---------------- REAL-TIME GLOBAL FEED ---------------- */

  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleFeedRefresh = payload => {
      console.log('Real-time feed event received:', payload);
      loadFeed(feedTab);
    };

    socket.on('feed:refresh', handleFeedRefresh);

    return () => {
      socket.off('feed:refresh', handleFeedRefresh);
    };
  }, [socket, user?.id, feedTab]);

  /* ---------------- PROFILE ---------------- */

  const openProfile = id => {
    setProfileId(id);
    setActive('Profile');
    setMobileOpen(false);
    window.scrollTo(0, 0);
  };

  const viewProfile = () => openProfile(user.id);

  /* ---------------- LOGOUT ---------------- */

  const signOut = () => {
    api.auth.logout();

    disconnectSocket();
    setSocket(null);

    setUser(null);
    setPosts([]);
    setProfileId(null);
    setActive('Home');
  };

  /* ---------------- CONNECTION REQUEST ---------------- */

  const connectTo = async id => {
    try {
      await api.connections.request(id);
    } catch (e) {
      alert(e.message);
    }

    loadSide();
  };

  /* ---------------- SEARCH FILTER ---------------- */

  const filteredPosts = useMemo(() => {
    return posts.filter(p =>
      `${p.name} ${p.role} ${p.text} ${(p.tags || []).join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  }, [posts, query]);

  /* ---------------- CREATE POST ---------------- */

  const addPost = async (text, mode = 'Post') => {
    try {
      const r = await api.posts.create({
        content: text,
        kind: ({ Project: 'project', Event: 'event' })[mode] || 'post'
      });

      if (r?.post) {
        setPosts(current => {
          const exists = current.some(
            p => Number(p.id) === Number(r.post.id)
          );

          if (exists) return current;

          return [mapPost(r.post), ...current];
        });
      }

      loadSide();

      return true;
    } catch (e) {
      alert(e.fields ? Object.values(e.fields).join(' ') : e.message);
      return false;
    }
  };

  /* ---------------- LIKE / UNLIKE POST ---------------- */

  const likePost = async id => {
    const post = posts.find(x => Number(x.id) === Number(id));

    if (!post) return;

    const wasLiked = post.liked;

    setPosts(current =>
      current.map(x =>
        Number(x.id) === Number(id)
          ? {
              ...x,
              liked: !wasLiked,
              likes: Math.max(
                0,
                x.likes + (wasLiked ? -1 : 1)
              )
            }
          : x
      )
    );

    try {
      if (wasLiked) {
        await api.posts.unreact(id);
      } else {
        await api.posts.react(id);
      }
    } catch (error) {
      console.error('Like update failed:', error);
      loadFeed();
    }
  };

  /* ---------------- SAVE / UNSAVE POST ---------------- */

  const savePost = async id => {
    const post = posts.find(x => Number(x.id) === Number(id));

    if (!post) return;

    const wasSaved = post.saved;

    setPosts(current =>
      current.map(x =>
        Number(x.id) === Number(id)
          ? { ...x, saved: !wasSaved }
          : x
      )
    );

    try {
      if (wasSaved) {
        await api.posts.unsave(id);
      } else {
        await api.posts.save(id);
      }
    } catch (error) {
      console.error('Save post failed:', error);
      loadFeed();
    }
  };

  /* ---------------- SHARE POST ---------------- */

  const sharePost = async (id, comment = '') => {
    try {
      await api.posts.share(id, comment);

      // Reload the current feed to get updated share count.
      await loadFeed();

      return true;
    } catch (error) {
      console.error('Share post failed:', error);
      alert(error.message || 'Post could not be shared.');
      return false;
    }
  };

  /* ---------------- SEND COMMENT ---------------- */

  const sendComment = async (id, text) => {
    try {
      const result = await api.posts.comment(id, text);

      setPosts(current =>
        current.map(x =>
          Number(x.id) === Number(id)
            ? {
                ...x,
                comments: x.comments + 1
              }
            : x
        )
      );

      return result?.comment || null;
    } catch (e) {
      alert(e.message || 'Comment could not be sent.');
      return null;
    }
  };

  /* ---------------- NAVIGATION ---------------- */

  const go = (page, q = '') => {
    if (page === 'Messages') {
      setMsgs(0);
    }

    setActive(page);
    setQuery(q);
    setMobileOpen(false);
    window.scrollTo(0, 0);
  };

  /* ---------------- LOADING SCREEN ---------------- */

  if (booting) {
    return (
      <div className="empty-search card" style={{ margin: 40 }}>
        <b>Loading DIULink…</b>
      </div>
    );
  }

  /* ---------------- LOGIN SCREEN ---------------- */

  if (!user) {
    return <Auth onEnter={setUser} />;
  }

  /* ---------------- RENDER POST ---------------- */

  const renderPost = p => (
    <PostCard
      key={p.id}
      post={p}
      onLike={likePost}
      onSave={savePost}
      onSend={sendComment}
      onShare={sharePost}
      onOpen={openProfile}
      meAvatar={user.avatarUrl}
      socket={socket}
    />
  );

  /* ---------------- MAIN UI ---------------- */

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        setActive={setActive}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onViewProfile={viewProfile}
        me={user}
        stats={stats}
      />

      <main className="main-area">
        <Header
          query={query}
          setQuery={setQuery}
          setMobileOpen={setMobileOpen}
          onViewProfile={viewProfile}
          onSignOut={signOut}
          go={go}
          notes={notes}
          setNotes={setNotes}
          msgs={msgs}
          role={user.role}
          me={user}
        />

        {active === 'Profile' ? (
          <div className="profile-content">
            <ProfilePage
              key={profileId ?? user.id}
              userId={profileId ?? user.id}
              me={user}
              onBack={() => setActive('Home')}
              onMeChange={u => {
                setUser(u);
                loadSide();
              }}
            />
          </div>
        ) : (
          <div className={`page-content ${active === 'Home' ? '' : 'wide'}`}>
            <div className="feed-column">
              {active === 'Home' ? (
                <>
                  <div className="welcome-row">
                    <div>
                      <h1>
                        {greeting()}, {user.name.split(' ')[0]}
                      </h1>

                      <p>
                        Clubs, events and batchmates, all in one place.
                      </p>
                    </div>

                    <div className="welcome-date">
                      <CalendarCheck size={16} />
                      {' '}
                      {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>

                  <div className="feed-tabs">
                    {[
                      ['forYou', 'For you'],
                      ['following', 'Following'],
                      ['latest', 'Latest']
                    ].map(([k, l]) => (
                      <button
                        key={k}
                        className={feedTab === k ? 'selected' : ''}
                        onClick={() => setFeedTab(k)}
                      >
                        {l}
                      </button>
                    ))}

                    <button className="filter-button">
                      <SlidersHorizontal size={15} />
                      Filters
                    </button>
                  </div>

                  <Composer onPost={addPost} me={user} />

                  {filteredPosts.length ? (
                    filteredPosts.map(renderPost)
                  ) : (
                    <div className="empty-search card">
                      <Search size={23} />

                      <b>
                        {query ? 'No posts found' : 'No posts yet'}
                      </b>

                      <span>
                        {feedErr || (
                          query
                            ? 'Try another search term.'
                            : 'Be the first to post something!'
                        )}
                      </span>
                    </div>
                  )}
                </>
              ) : active === 'My Network' ? (
                <Network openProfile={openProfile} />
              ) : (
                <Page
                  name={active}
                  posts={posts}
                  go={go}
                  notes={notes}
                  setNotes={setNotes}
                  onSignOut={signOut}
                  renderPost={renderPost}
                />
              )}
            </div>

            {active === 'Home' && (
              <RightRail
                people={people}
                onConnect={connectTo}
                onOpen={openProfile}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
