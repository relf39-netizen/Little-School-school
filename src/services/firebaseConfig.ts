
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// 🟢 ใส่ค่า Supabase Project URL และ API Key ตรงนี้
// ---------------------------------------------------------------------------
// คุณสามารถหาค่าเหล่านี้ได้ที่ Supabase Dashboard -> Settings -> API
const SUPABASE_URL = "https://aqbtgcunbcvlmhzdrewy.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxYnRnY3VuYmN2bG1oemRyZXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMTU1NDcsImV4cCI6MjA4MDc5MTU0N30.FjjKcJjf8pGlb1k3jrNcP_8ojEhbCcuqWcD_zdEFWnc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export db for compatibility (allows us to use 'db' in other files if needed)
export const db = supabase;

/* 
  === 🟢 คำแนะนำสำหรับการสร้าง Table ใน Supabase (SQL Editor) ===
  
  ให้ Copy SQL ด้านล่างไปรันในเมนู SQL Editor ของ Supabase Dashboard เพื่อสร้างตาราง

  -- 1. ตารางนักเรียน
  create table students (
    id text primary key,
    name text,
    school text,
    avatar text,
    stars int default 0,
    grade text,
    teacher_id text,
    quiz_count int default 0,
    tokens int default 0,
    level int default 1,
    inventory jsonb default '[]'::jsonb
  );

  -- 2. ตารางครู
  create table teachers (
    id text primary key,
    username text,
    password text,
    name text,
    school text,
    role text,
    grade_level text,
    citizen_id text
  );

  -- 3. ตารางโรงเรียน
  create table schools (
    id text primary key,
    name text,
    status text default 'active'
  );

  -- 4. ตารางวิชา
  create table subjects (
    id text primary key,
    name text,
    school text,
    teacher_id text,
    grade text,
    icon text,
    color text
  );

  -- 5. ตารางข้อสอบ
  create table questions (
    id text primary key,
    subject text,
    text text,
    image text,
    choices jsonb, -- เก็บตัวเลือกเป็น Array JSON
    correct_choice_id text,
    explanation text,
    grade text,
    school text,
    teacher_id text
  );

  -- 6. ตารางการบ้าน
  create table assignments (
    id text primary key,
    school text,
    subject text,
    grade text,
    question_count int,
    deadline text,
    created_by text,
    title text
  );

  -- 7. ตารางผลสอบ
  create table exam_results (
    id text primary key,
    student_id text references students(id),
    student_name text,
    school text,
    score int,
    total_questions int,
    subject text,
    assignment_id text,
    timestamp bigint
  );

  -- 8. ตารางเกม (สำหรับโหมดแข่งขัน Realtime)
  create table games (
    room_code text primary key,
    status text,
    current_question_index int,
    total_questions int,
    subject text,
    grade text,
    time_per_question int,
    timer int,
    school_id text,
    questions jsonb -- เก็บ Snapshot ข้อสอบของเกมนั้นๆ
  );

  -- 9. ตารางผู้เล่นในเกม
  create table game_players (
    id serial primary key,
    room_code text references games(room_code) on delete cascade,
    student_id text,
    name text,
    avatar text,
    score int default 0,
    online boolean default true
  );

  -- IMPORTANT: อย่าลืมเปิด Realtime Replication ให้ตาราง 'games' และ 'game_players'
  -- ไปที่ Database -> Replication -> Source -> เลือกตาราง -> Toggle ON
*/
