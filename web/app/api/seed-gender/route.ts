import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Male first names (lower-case)
const MALE_FIRST_NAMES = new Set([
  'david','tom','harold','mike','james','ray','greg','rick','brian','dale',
  'kevin','robert','carlos','eric','frank','william','john','jack','jose',
  'george','paul','anthony','richard','mark','joseph','charles','thomas',
  'christopher','daniel','matthew','donald','steven','timothy','larry',
  'gary','raymond','roger','eugene','henry','walter','arthur','wayne',
  'joe','bob','bill','jim','tim','dave','don','ron','dan','sam','al',
  'ed','fred','jeff','scott','steve','tony','ken','keith','brad','chad',
  'phil','ben','peter','ryan','travis','todd','jake','derek','hank',
  'blake','corey','troy','lance','glen','dean','alan','allen','aaron',
  'adam','alex','andrew','andy','barry','brent','brett','bruce','bryan',
  'calvin','carl','casey','cliff','clint','colin','craig','curt','curtis',
  'kyle','lee','leon','leo','lester','lloyd','logan','luis','marcus',
  'mario','martin','max','miguel','nathan','neil','nick','oliver','oscar',
  'patrick','perry','phillip','randy','reed','rob','rod','rodrigo','ross',
  'ruben','russ','russell','seth','shane','shawn','simon','stanley','ted',
  'terrence','terry','trey','tyler','vince','vincent','wade','warren',
  'zach','zachary','hassan','raj','wei','omar','tariq','lucas','gabriel',
  'ivan','marco','ernesto','francisco','jeff','dennis','jerome','leonard',
  'victor','doug','jared','will','gerald','danny','mitchell','evan',
  'eduardo','vic','nate','brandon','derrick','antonio','sean','chuck',
  'howard','ronald','roberto','chris',
]);

// Female first names (lower-case)  
const FEMALE_FIRST_NAMES = new Set([
  'karen','sandra','beverly','ashley','priya','linda','maria','catherine',
  'debra','cheryl','janet','ruth','patricia','barbara','jennifer','lisa',
  'mary','nancy','helen','dorothy','betty','shirley','virginia','joan',
  'ann','anna','anne','brenda','carol','carolyn','charlotte','christy',
  'cindy','claire','cynthia','diana','diane','donna','doris','elaine',
  'elizabeth','ellen','emily','emma','ethel','evelyn','florence','frances',
  'grace','harriet','hazel','heather','irene','jane','jean','jessica',
  'jo','joyce','judith','judy','julia','julie','june','kate','kathleen',
  'kathy','kelly','kim','kristin','laura','lauren','leah','lori','lucy',
  'lynn','margaret','marilyn','martha','melanie','melissa','michelle',
  'molly','monica','nicole','norma','pamela','paula','peggy','penny',
  'phyllis','rachel','rebecca','renee','rose','sara','sarah','sharon',
  'shirley','stephanie','sue','susan','sylvia','tammy','teresa','tiffany',
  'tina','tracy','victoria','vivian','wendy','yvonne','angela','camille',
  'loretta','gloria','connie','gail','roberta','wanda','theresa','rosa',
  'amara','sophie','denise','yolanda','pauline','bettina','olivia','vicki',
  'kay','marcy','christine','anita','caroline','gretchen','alicia','nora',
  'cathy',
]);

function inferGender(name: string): 'male' | 'female' {
  const first = name.toLowerCase().split(/[\s,.()\-'"]+/)[0];
  if (FEMALE_FIRST_NAMES.has(first)) return 'female';
  if (MALE_FIRST_NAMES.has(first)) return 'male';
  // Special cases
  if (name.toLowerCase().includes('jerome and linda')) return 'female'; // Linda speaking
  return 'female'; // safe default matches current Vapi voice
}

export async function POST() {
  // Fetch all personas
  const { data: personas, error } = await supabaseAdmin
    .from('personas')
    .select('id, name')
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const maleIds: string[] = [];
  const femaleIds: string[] = [];
  const assignments: Array<{ name: string; gender: string }> = [];

  for (const p of personas ?? []) {
    const gender = inferGender(p.name);
    assignments.push({ name: p.name, gender });
    if (gender === 'male') maleIds.push(p.id);
    else femaleIds.push(p.id);
  }

  // Update male
  if (maleIds.length > 0) {
    const { error: e } = await supabaseAdmin
      .from('personas')
      .update({ gender: 'male' })
      .in('id', maleIds);
    if (e) return NextResponse.json({ error: 'male update: ' + e.message }, { status: 500 });
  }

  // Update female
  if (femaleIds.length > 0) {
    const { error: e } = await supabaseAdmin
      .from('personas')
      .update({ gender: 'female' })
      .in('id', femaleIds);
    if (e) return NextResponse.json({ error: 'female update: ' + e.message }, { status: 500 });
  }

  return NextResponse.json({
    total: personas?.length ?? 0,
    male: maleIds.length,
    female: femaleIds.length,
    assignments,
  });
}
