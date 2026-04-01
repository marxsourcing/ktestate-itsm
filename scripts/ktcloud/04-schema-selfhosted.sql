-- ============================================================
-- KT Estate - Supabase 셀프호스팅용 스키마
-- Supabase Docker 환경에서 실행 (auth.users 존재)
-- psql 또는 Supabase Studio SQL Editor에서 실행
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 확장 기능
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- 2. ENUM 타입
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('requester', 'manager', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sr_status AS ENUM (
    'draft', 'requested', 'approved', 'consulting', 'accepted',
    'reviewing', 'processing', 'test_requested', 'test_completed',
    'deploy_requested', 'deploy_approved', 'completed', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sr_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending', 'ready', 'done', 'canceled',
    'partial_canceled', 'aborted', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. 테이블 (auth.users FK 연결)
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'requester',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  department TEXT,
  phone TEXT,
  avatar_url TEXT,
  notification_settings JSONB DEFAULT '{"comment_added": true, "status_changed": true, "request_created": true, "request_assigned": true, "request_completed": true}'::jsonb,
  birthday DATE,
  birth_date DATE
);

CREATE TABLE IF NOT EXISTS systems (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  code VARCHAR UNIQUE
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  user_id UUID REFERENCES profiles(id),
  system_id UUID REFERENCES systems(id),
  serial_number TEXT,
  purchase_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES systems(id),
  code VARCHAR UNIQUE NOT NULL,
  name TEXT NOT NULL,
  primary_manager_id UUID REFERENCES profiles(id),
  secondary_manager_id UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  notify_primary BOOLEAN DEFAULT true,
  delay_notification BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_categories_lv1 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_categories_lv2 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_lv1_id UUID REFERENCES request_categories_lv1(id),
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requester_id UUID NOT NULL REFERENCES profiles(id),
  manager_id UUID REFERENCES profiles(id),
  status sr_status NOT NULL DEFAULT 'requested',
  priority sr_priority NOT NULL DEFAULT 'medium',
  system_id UUID REFERENCES systems(id),
  asset_id UUID REFERENCES assets(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  module_id UUID REFERENCES system_modules(id),
  deploy_type TEXT CHECK (deploy_type = ANY (ARRAY['scheduled', 'unscheduled'])),
  deploy_manager_id UUID REFERENCES profiles(id),
  deploy_scheduled_at TIMESTAMPTZ,
  deploy_completed_at TIMESTAMPTZ,
  test_manager_id UUID REFERENCES profiles(id),
  estimated_fp NUMERIC,
  actual_fp NUMERIC,
  estimated_md NUMERIC,
  actual_md NUMERIC,
  category_lv1_id UUID REFERENCES request_categories_lv1(id),
  category_lv2_id UUID REFERENCES request_categories_lv2(id),
  deploy_batch_id UUID,
  deploy_batch_name TEXT,
  embedding vector(768)
);

CREATE TABLE IF NOT EXISTS sr_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES service_requests(id),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sr_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES service_requests(id),
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL DEFAULT '새 대화',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active', 'confirmed', 'archived'])),
  request_id UUID REFERENCES service_requests(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL DEFAULT 'requester' CHECK (type = ANY (ARRAY['requester', 'manager'])),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL CHECK (role = ANY (ARRAY['user', 'assistant', 'system'])),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id),
  request_id UUID REFERENCES service_requests(id),
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  comment_id UUID REFERENCES sr_comments(id),
  conversation_id UUID REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type = ANY (ARRAY['request_created', 'request_assigned', 'status_changed', 'comment_added', 'request_completed'])),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manager_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES service_requests(id),
  manager_id UUID REFERENCES profiles(id),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manager_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES manager_conversations(id),
  role TEXT NOT NULL CHECK (role = ANY (ARRAY['user', 'assistant', 'system'])),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES service_requests(id),
  document_type VARCHAR NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  system_id UUID REFERENCES systems(id),
  module_id UUID REFERENCES system_modules(id),
  category_lv1_id UUID,
  category_lv2_id UUID,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id TEXT NOT NULL UNIQUE,
  payment_key TEXT UNIQUE,
  order_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  method TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  receipt_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. auth.users → profiles 자동 생성 트리거
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'requester'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. 비즈니스 함수
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_manager_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE manager_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_on_new_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.manager_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.manager_id,
      'request_assigned',
      '새 요청 배정',
      format('새로운 요청 "%s"이(가) 배정되었습니다.', NEW.title),
      format('/requests/%s', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_on_request_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_label TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    status_label := CASE NEW.status::TEXT
      WHEN 'draft' THEN '작성중'
      WHEN 'requested' THEN '요청'
      WHEN 'approved' THEN '승인'
      WHEN 'consulting' THEN '실무협의'
      WHEN 'accepted' THEN '접수'
      WHEN 'processing' THEN '처리중'
      WHEN 'test_requested' THEN '테스트요청'
      WHEN 'test_completed' THEN '테스트완료'
      WHEN 'deploy_requested' THEN '배포요청'
      WHEN 'deploy_approved' THEN '배포승인'
      WHEN 'completed' THEN '완료'
      WHEN 'rejected' THEN '반려'
      ELSE NEW.status::TEXT
    END;
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.requester_id,
      'status_changed',
      '요청 상태 변경',
      format('요청 "%s"의 상태가 %s(으)로 변경되었습니다.', NEW.title, status_label),
      format('/requests/%s', NEW.id)
    );
    IF NEW.manager_id IS NOT NULL AND NEW.manager_id != NEW.requester_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        NEW.manager_id,
        'status_changed',
        '담당 요청 상태 변경',
        format('담당 요청 "%s"의 상태가 %s(으)로 변경되었습니다.', NEW.title, status_label),
        format('/requests/%s', NEW.id)
      );
    END IF;
  END IF;
  IF OLD.manager_id IS NULL AND NEW.manager_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.manager_id,
      'request_assigned',
      '새 요청 배정',
      format('요청 "%s"이(가) 배정되었습니다.', NEW.title),
      format('/requests/%s', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION match_service_requests(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.3,
  match_count integer DEFAULT 5,
  exclude_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid, title text, description text, status text,
  system_id uuid, system_name text,
  category_lv1_name text, category_lv2_name text,
  created_at timestamptz, similarity double precision
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id, sr.title, sr.description, sr.status::text,
    sr.system_id, s.name::text AS system_name,
    c1.name::text AS category_lv1_name,
    c2.name::text AS category_lv2_name,
    sr.created_at,
    (1 - (sr.embedding <=> query_embedding))::float AS similarity
  FROM service_requests sr
  LEFT JOIN systems s ON sr.system_id = s.id
  LEFT JOIN request_categories_lv1 c1 ON sr.category_lv1_id = c1.id
  LEFT JOIN request_categories_lv2 c2 ON sr.category_lv2_id = c2.id
  WHERE
    sr.embedding IS NOT NULL
    AND (exclude_id IS NULL OR sr.id != exclude_id)
    AND (1 - (sr.embedding <=> query_embedding)) > match_threshold
  ORDER BY sr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_rag_documents(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.3,
  match_count integer DEFAULT 5,
  filter_system_id uuid DEFAULT NULL,
  filter_document_type varchar DEFAULT NULL
)
RETURNS TABLE(
  id uuid, request_id uuid, document_type varchar,
  title text, content text, system_name text,
  similarity double precision
) LANGUAGE sql STABLE AS $$
  SELECT
    rd.id, rd.request_id, rd.document_type,
    rd.title, rd.content, s.name as system_name,
    1 - (rd.embedding <=> query_embedding) as similarity
  FROM rag_documents rd
  LEFT JOIN systems s ON rd.system_id = s.id
  WHERE rd.is_active = true
    AND (filter_system_id IS NULL OR rd.system_id = filter_system_id)
    AND (filter_document_type IS NULL OR rd.document_type = filter_document_type)
    AND 1 - (rd.embedding <=> query_embedding) > match_threshold
  ORDER BY rd.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION search_service_requests_for_similarity(
  search_system_id uuid DEFAULT NULL,
  exclude_id uuid DEFAULT NULL,
  result_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid, title text, description text, status text,
  system_name text, category_lv1_name text, category_lv2_name text,
  created_at timestamptz
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id, sr.title, sr.description, sr.status::text,
    s.name::text AS system_name,
    c1.name::text AS category_lv1_name,
    c2.name::text AS category_lv2_name,
    sr.created_at
  FROM service_requests sr
  LEFT JOIN systems s ON sr.system_id = s.id
  LEFT JOIN request_categories_lv1 c1 ON sr.category_lv1_id = c1.id
  LEFT JOIN request_categories_lv2 c2 ON sr.category_lv2_id = c2.id
  WHERE
    (search_system_id IS NULL OR sr.system_id = search_system_id)
    AND (exclude_id IS NULL OR sr.id != exclude_id)
  ORDER BY sr.created_at DESC
  LIMIT result_limit;
END;
$$;

-- ============================================================
-- 6. 트리거
-- ============================================================
CREATE TRIGGER update_service_requests_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_systems_updated_at
  BEFORE UPDATE ON systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_payments_updated_at();

CREATE TRIGGER trigger_new_request
  AFTER INSERT ON service_requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_new_request();

CREATE TRIGGER trigger_request_status_change
  AFTER UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_request_status_change();

CREATE TRIGGER trigger_update_manager_conversation_updated_at
  AFTER INSERT ON manager_messages
  FOR EACH ROW EXECUTE FUNCTION update_manager_conversation_updated_at();

-- ============================================================
-- 7. 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_request_type ON conversations(request_id, type) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_sr_comments_request_id ON sr_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_sr_comments_created_at ON sr_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sr_history_request_id ON sr_history(request_id);
CREATE INDEX IF NOT EXISTS idx_sr_history_created_at ON sr_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_comment_id ON attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_manager_conversations_manager_id ON manager_conversations(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_conversations_request_id ON manager_conversations(request_id);
CREATE INDEX IF NOT EXISTS idx_manager_messages_conversation_id ON manager_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_manager_messages_created_at ON manager_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_system_modules_system_id ON system_modules(system_id);
CREATE INDEX IF NOT EXISTS idx_system_modules_code ON system_modules(code);
CREATE INDEX IF NOT EXISTS idx_system_modules_is_active ON system_modules(is_active);
CREATE INDEX IF NOT EXISTS idx_request_categories_lv1_code ON request_categories_lv1(code);
CREATE INDEX IF NOT EXISTS idx_request_categories_lv1_active ON request_categories_lv1(is_active);
CREATE INDEX IF NOT EXISTS idx_request_categories_lv2_code ON request_categories_lv2(code);
CREATE INDEX IF NOT EXISTS idx_request_categories_lv2_active ON request_categories_lv2(is_active);
CREATE INDEX IF NOT EXISTS idx_request_categories_lv2_lv1 ON request_categories_lv2(category_lv1_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_module_id ON service_requests(module_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_category_lv1 ON service_requests(category_lv1_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_category_lv2 ON service_requests(category_lv2_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_test_manager ON service_requests(test_manager_id) WHERE test_manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_requests_deploy_batch_id ON service_requests(deploy_batch_id) WHERE deploy_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_request ON rag_documents(request_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_system ON rag_documents(system_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_type ON rag_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_rag_documents_active ON rag_documents(is_active);

CREATE INDEX IF NOT EXISTS service_requests_embedding_idx ON service_requests USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding ON rag_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- 8. RLS 정책 (Supabase auth.uid() 사용)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own_or_admin" ON profiles FOR UPDATE
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_select_own" ON service_requests FOR SELECT USING (auth.uid() = requester_id);
CREATE POLICY "sr_select_manager" ON service_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')));
CREATE POLICY "sr_insert_own" ON service_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "sr_update_own_requested" ON service_requests FOR UPDATE
  USING (auth.uid() = requester_id AND status = 'requested');
CREATE POLICY "sr_update_manager" ON service_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')));

ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "systems_select_all" ON systems FOR SELECT USING (true);
CREATE POLICY "systems_modify_manager" ON systems FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')));

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_select_own" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conv_insert_own" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conv_update_own" ON conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "conv_delete_own" ON conversations FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_select_own_conv" ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
CREATE POLICY "msg_insert_own_conv" ON messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_insert_any" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE USING (user_id = auth.uid());

ALTER TABLE sr_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all" ON sr_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_auth" ON sr_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_update_own" ON sr_comments FOR UPDATE USING (auth.uid() = author_id);

ALTER TABLE sr_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history_select_all" ON sr_history FOR SELECT USING (true);
CREATE POLICY "history_insert_auth" ON sr_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attach_select_all" ON attachments FOR SELECT USING (true);
CREATE POLICY "attach_insert_own" ON attachments FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_select_all" ON assets FOR SELECT USING (true);
CREATE POLICY "assets_modify_manager" ON assets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')));

ALTER TABLE system_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_select_all" ON system_modules FOR SELECT USING (true);
CREATE POLICY "modules_modify_manager" ON system_modules FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')));

ALTER TABLE request_categories_lv1 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_lv1_select_all" ON request_categories_lv1 FOR SELECT USING (true);

ALTER TABLE request_categories_lv2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_lv2_select_all" ON request_categories_lv2 FOR SELECT USING (true);

ALTER TABLE manager_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mgr_conv_select_own" ON manager_conversations FOR SELECT USING (auth.uid() = manager_id);
CREATE POLICY "mgr_conv_insert_own" ON manager_conversations FOR INSERT WITH CHECK (auth.uid() = manager_id);
CREATE POLICY "mgr_conv_update_own" ON manager_conversations FOR UPDATE USING (auth.uid() = manager_id);

ALTER TABLE manager_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mgr_msg_select_own" ON manager_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM manager_conversations WHERE manager_conversations.id = manager_messages.conversation_id AND manager_conversations.manager_id = auth.uid()));
CREATE POLICY "mgr_msg_insert_own" ON manager_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM manager_conversations WHERE manager_conversations.id = manager_messages.conversation_id AND manager_conversations.manager_id = auth.uid()));

ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rag_select_all" ON rag_documents FOR SELECT USING (true);
CREATE POLICY "rag_modify_manager" ON rag_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')));

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select_own" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payments_insert_own" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 9. Storage 버킷 생성
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "attachments_select_auth" ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "attachments_insert_auth" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "attachments_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_select_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert_auth" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

COMMIT;
