
import React, { useEffect, useState } from 'react';
import {
  Search, Users, ArrowLeft, UserPlus, Check,
  Clock, Loader2
} from 'lucide-react';
import { api } from './lib/api.js';

const categories = ['All', 'Tech', 'Creative', 'Career', 'Culture', 'General'];

export default function ClubPage() {
  const [clubs, setClubs] = useState([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClubs = async () => {
    try {
      setLoading(true);
      const result = await api.clubs.list({
        category,
        q: search
      });
      setClubs(result.items || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClubs();
  }, [category, search]);

  const openClub = async (club) => {
    try {
      const [detail, memberData, postData] = await Promise.all([
        api.clubs.get(club.id),
        api.clubs.members(club.id),
        api.posts.byClub(club.id)
      ]);

      setSelected(detail.club);
      setMembers(memberData.items || []);
      setPosts(postData.items || []);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMembership = async () => {
    if (!selected) return;

    try {
      if (selected.joined || selected.pending) {
        await api.clubs.leave(selected.id);
      } else {
        await api.clubs.join(selected.id);
      }

      const result = await api.clubs.get(selected.id);
      setSelected(result.club);
      await loadClubs();
    } catch (err) {
      alert(err.message);
    }
  };

  if (selected) {
    return (
      <div className="club-page">
        <button
          className="btn-outline btn-sm"
          onClick={() => setSelected(null)}
        >
          <ArrowLeft size={16} /> Back to clubs
        </button>

        <div className="club-profile card">
          <div className="club-cover">
            {selected.coverUrl && (
              <img src={selected.coverUrl} alt="Club cover" />
            )}
          </div>

          <div className="club-profile-info">
            <img
              className="club-logo"
              src={selected.imageUrl || '/club-placeholder.png'}
              alt={selected.name}
            />

            <h1>{selected.name}</h1>
            <span className="tag">{selected.category}</span>

            <p>{selected.description}</p>

            <div className="club-stats">
              <span>
                <Users size={17} />
                {selected.memberCount} members
              </span>
            </div>

            <button
              className="btn-primary"
              onClick={handleMembership}
            >
              {selected.joined ? 'Leave club' :
               selected.pending ? 'Cancel request' :
               selected.joinPolicy === 'approval' ? 'Request to join' :
               'Join club'}
            </button>
          </div>
        </div>

        <section className="card club-section">
          <h2>Club members</h2>
          {members.length ? members.map(member => (
            <div className="club-member" key={member.id}>
              <img
                src={member.avatarUrl || '/avatar-placeholder.png'}
                alt=""
              />
              <div>
                <strong>{member.name}</strong>
                <small>{member.clubRole === 'admin' ? 'Club Admin' : 'Member'}</small>
              </div>
            </div>
          )) : <p>No members found.</p>}
        </section>

        <section className="club-section">
          <h2>Club posts & announcements</h2>
          {posts.length ? posts.map(post => (
            <article className="card club-post" key={post.id}>
              <strong>
                {post.author?.name || selected.name}
              </strong>
              <p>{post.content}</p>
              {post.imageUrl && (
                <img src={post.imageUrl} alt="Club post" />
              )}
              <small>
                {post.counts?.reactions || 0} reactions ·
                {' '}{post.counts?.comments || 0} comments
              </small>
            </article>
          )) : <div className="card club-section">
            No posts yet.
          </div>}
        </section>
      </div>
    );
  }

  return (
    <div className="club-page">
      <div className="welcome-row">
        <div>
          <h1>Clubs & Communities</h1>
          <p>Discover your community at DIU.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="club-search">
          <Search size={18} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clubs..."
          />
        </div>
      </div>

      <div className="feed-tabs">
        {categories.map(cat => (
          <button
            key={cat}
            className={category === cat ? 'selected' : ''}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-search card">
          <Loader2 className="spin" />
          Loading clubs...
        </div>
      ) : error ? (
        <div className="empty-search card">{error}</div>
      ) : clubs.length ? (
        <div className="grid-cards">
          {clubs.map(club => (
            <article className="card tile" key={club.id}>
              <div className="tile-top">
                <img
                  className="club-logo"
                  src={club.imageUrl || '/club-placeholder.png'}
                  alt=""
                />
                <div>
                  <b>{club.name}</b>
                  <span className="sub">
                    {club.memberCount} members
                  </span>
                </div>
              </div>

              <span className="tag">{club.category}</span>
              <p>{club.description}</p>

              <div className="tile-foot">
                <button
                  className="btn-outline btn-sm"
                  onClick={() => openClub(club)}
                >
                  View club
                </button>

                <button
                  className="btn-primary btn-sm"
                  onClick={async () => {
                    try {
                      if (club.joined || club.pending) {
                        await api.clubs.leave(club.id);
                      } else {
                        await api.clubs.join(club.id);
                      }
                      await loadClubs();
                    } catch (err) {
                      alert(err.message);
                    }
                  }}
                >
                  {club.joined ? <><Check size={14}/> Joined</> :
                   club.pending ? <><Clock size={14}/> Pending</> :
                   <><UserPlus size={14}/> Join</>}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-search card">
          No clubs found. Try another search.
        </div>
      )}
    </div>
  );
}
