-- DIULink MySQL schema (MySQL 8.0+, InnoDB, utf8mb4)
-- This file can be imported directly in phpMyAdmin without manually selecting a database.
-- It creates (if needed) and selects the database used by the backend: diulink.
CREATE DATABASE IF NOT EXISTS diulink
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE diulink;

SET NAMES utf8mb4;

/* ---------------------------------------------------------------- users */
CREATE TABLE IF NOT EXISTS users (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(190) NOT NULL,
  password_hash   VARCHAR(100) NOT NULL,
  role            ENUM('student','alumni','admin') NOT NULL DEFAULT 'student',
  status          ENUM('pending_email','pending_review','active','suspended','rejected') NOT NULL DEFAULT 'pending_email',
  email_verified  TINYINT(1) NOT NULL DEFAULT 0,
  student_id      VARCHAR(20) NULL,
  department      VARCHAR(120) NULL,
  graduation_year SMALLINT UNSIGNED NULL,
  headline        VARCHAR(160) NULL,
  bio             TEXT NULL,
  location        VARCHAR(120) NULL,
  avatar_url      VARCHAR(500) NULL,
  cover_url       VARCHAR(500) NULL,
  github_url      VARCHAR(255) NULL,
  linkedin_url    VARCHAR(255) NULL,
  company         VARCHAR(120) NULL,          -- alumni: current employer
  job_title       VARCHAR(120) NULL,          -- alumni: current role
  industry        VARCHAR(60)  NULL,          -- alumni: Engineering / Design / Product / Data ...
  proof_public_id VARCHAR(255) NULL,          -- alumni with personal email: private Cloudinary asset
  proof_format    VARCHAR(10)  NULL,
  review_note     VARCHAR(255) NULL,
  settings        JSON NULL,
  last_seen_at    DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_student_id (student_id),
  KEY idx_users_role_status (role, status),
  KEY idx_users_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_codes (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  purpose    ENUM('verify_email','reset_password') NOT NULL,
  code_hash  CHAR(64) NOT NULL,
  attempts   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_codes_user (user_id, purpose, created_at),
  CONSTRAINT fk_codes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ------------------------------------------------------ profile sections */
CREATE TABLE IF NOT EXISTS user_skills (
  user_id BIGINT UNSIGNED NOT NULL,
  skill   VARCHAR(60) NOT NULL,
  PRIMARY KEY (user_id, skill),
  CONSTRAINT fk_skills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS education (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  institution VARCHAR(160) NOT NULL,
  degree      VARCHAR(160) NULL,
  start_year  SMALLINT UNSIGNED NULL,
  end_year    SMALLINT UNSIGNED NULL,
  is_expected TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_edu_user (user_id),
  CONSTRAINT fk_edu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS experience (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  company     VARCHAR(160) NOT NULL,
  title       VARCHAR(160) NOT NULL,
  start_date  DATE NULL,
  end_date    DATE NULL,
  description TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_exp_user (user_id),
  CONSTRAINT fk_exp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS projects (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(160) NOT NULL,
  type        VARCHAR(80) NULL,
  description TEXT NULL,
  image_url   VARCHAR(500) NULL,
  project_url VARCHAR(255) NULL,
  tags        JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_projects_user (user_id),
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ---------------------------------------------------------- connections */
CREATE TABLE IF NOT EXISTS connections (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  requester_id BIGINT UNSIGNED NOT NULL,
  addressee_id BIGINT UNSIGNED NOT NULL,
  status       ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  -- One row per pair, whichever direction the request was sent
  pair_key VARCHAR(41) GENERATED ALWAYS AS (CONCAT(LEAST(requester_id, addressee_id), '-', GREATEST(requester_id, addressee_id))) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_connections_pair (pair_key),
  KEY idx_conn_addressee (addressee_id, status),
  KEY idx_conn_requester (requester_id, status),
  CONSTRAINT fk_conn_req FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conn_adr FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_conn_self CHECK (requester_id <> addressee_id)
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW connection_edges AS
  SELECT requester_id AS user_id, addressee_id AS friend_id FROM connections WHERE status = 'accepted'
  UNION ALL
  SELECT addressee_id AS user_id, requester_id AS friend_id FROM connections WHERE status = 'accepted';

/* ----------------------------------------------------------------- clubs */
CREATE TABLE IF NOT EXISTS clubs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  category    VARCHAR(40) NOT NULL DEFAULT 'General',
  description TEXT NULL,
  image_url   VARCHAR(500) NULL,
  cover_url   VARCHAR(500) NULL,
  join_policy ENUM('open','approval') NOT NULL DEFAULT 'open',
  created_by  BIGINT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clubs_name (name),
  KEY idx_clubs_category (category),
  CONSTRAINT fk_clubs_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS club_members (
  club_id   BIGINT UNSIGNED NOT NULL,
  user_id   BIGINT UNSIGNED NOT NULL,
  role      ENUM('member','admin') NOT NULL DEFAULT 'member',
  status    ENUM('active','pending') NOT NULL DEFAULT 'active',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (club_id, user_id),
  KEY idx_cm_user (user_id, status),
  CONSTRAINT fk_cm_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ----------------------------------------------------------------- posts */
CREATE TABLE IF NOT EXISTS posts (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        BIGINT UNSIGNED NOT NULL,
  club_id        BIGINT UNSIGNED NULL,
  kind           ENUM('post','project','event','announcement','share') NOT NULL DEFAULT 'post',
  content        TEXT NULL,
  image_url      VARCHAR(500) NULL,
  video_url      VARCHAR(500) NULL,
  category       VARCHAR(40) NULL,             -- Explore topic: Promotional, Events, Campus life, Tech, Creative
  shared_post_id BIGINT UNSIGNED NULL,
  view_count     INT UNSIGNED NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_posts_created (created_at),
  KEY idx_posts_user (user_id, created_at),
  KEY idx_posts_club (club_id, created_at),
  KEY idx_posts_shared (shared_post_id),
  KEY idx_posts_views (view_count),
  CONSTRAINT fk_posts_user   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_club   FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL,
  CONSTRAINT fk_posts_shared FOREIGN KEY (shared_post_id) REFERENCES posts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id BIGINT UNSIGNED NOT NULL,
  tag     VARCHAR(60) NOT NULL,
  PRIMARY KEY (post_id, tag),
  KEY idx_tag (tag),
  CONSTRAINT fk_tags_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reactions (
  post_id    BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  type       ENUM('like','love','celebrate','insightful','support') NOT NULL DEFAULT 'like',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  KEY idx_reactions_user (user_id),
  CONSTRAINT fk_react_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_react_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comments (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id    BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  parent_id  BIGINT UNSIGNED NULL,
  content    VARCHAR(2000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comments_post (post_id, id),
  CONSTRAINT fk_comments_post   FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saved_posts (
  user_id    BIGINT UNSIGNED NOT NULL,
  post_id    BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id),
  CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ---------------------------------------------------------------- events */
CREATE TABLE IF NOT EXISTS events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title       VARCHAR(160) NOT NULL,
  description TEXT NULL,
  category    VARCHAR(40) NOT NULL DEFAULT 'General',
  location    VARCHAR(160) NULL,
  starts_at   DATETIME NOT NULL,
  ends_at     DATETIME NULL,
  club_id     BIGINT UNSIGNED NULL,
  host_id     BIGINT UNSIGNED NOT NULL,
  image_url   VARCHAR(500) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_events_start (starts_at),
  KEY idx_events_category (category),
  CONSTRAINT fk_events_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL,
  CONSTRAINT fk_events_host FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS event_attendees (
  event_id   BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, user_id),
  KEY idx_ea_user (user_id),
  CONSTRAINT fk_ea_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_ea_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ------------------------------------------------------------------ jobs */
CREATE TABLE IF NOT EXISTS jobs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  posted_by   BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(160) NOT NULL,
  company     VARCHAR(160) NOT NULL,
  kind        ENUM('job','internship','alumni_referral','on_campus') NOT NULL DEFAULT 'job',
  location    VARCHAR(160) NULL,
  description TEXT NULL,
  tags        JSON NULL,
  apply_url   VARCHAR(500) NULL,
  event_date  DATETIME NULL,                 -- on-campus drives
  deadline    DATE NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_jobs_kind (kind, is_active, created_at),
  CONSTRAINT fk_jobs_user FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS job_saves (
  user_id    BIGINT UNSIGNED NOT NULL,
  job_id     BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, job_id),
  CONSTRAINT fk_js_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_js_job  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS job_applications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id     BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  note       TEXT NULL,
  resume_url VARCHAR(500) NULL,
  status     ENUM('submitted','shortlisted','rejected','hired') NOT NULL DEFAULT 'submitted',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_application (job_id, user_id),
  KEY idx_app_user (user_id),
  CONSTRAINT fk_app_job  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* -------------------------------------------------------------- messaging */
CREATE TABLE IF NOT EXISTS conversations (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type            ENUM('direct','group') NOT NULL DEFAULT 'direct',
  title           VARCHAR(120) NULL,
  direct_key      VARCHAR(41) NULL,          -- "<lowId>-<highId>", prevents duplicate 1:1 chats
  last_message_at DATETIME(3) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conv_direct (direct_key),
  KEY idx_conv_last (last_message_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id      BIGINT UNSIGNED NOT NULL,
  user_id              BIGINT UNSIGNED NOT NULL,
  last_read_message_id BIGINT UNSIGNED NULL,
  joined_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id),
  KEY idx_cp_user (user_id),
  CONSTRAINT fk_cp_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id       BIGINT UNSIGNED NOT NULL,
  content         TEXT NOT NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_messages_conv (conversation_id, id),
  CONSTRAINT fk_msg_conv   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ---------------------------------------------------------- notifications */
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  actor_id    BIGINT UNSIGNED NULL,
  type        VARCHAR(40) NOT NULL,          -- reaction, comment, share, connection_request, connection_accepted, job, club_join, event ...
  entity_type VARCHAR(30) NULL,
  entity_id   BIGINT UNSIGNED NULL,
  message     VARCHAR(255) NOT NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, is_read, id),
  CONSTRAINT fk_notif_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
