// Supabase 연동 시작
const { createClient } = supabase;
const supabaseUrl = 'https://iunzzneyarkjdmyyodfb.supabase.co';
const supabaseKey = 'sb_publishable_dnWZP0esqw-S4bnqElKOoQ_D2qMryFX';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// 테스트용 사전 승인된 추천인 코드
const VALID_CODES = ['VIP2026', 'INVITE_ONLY', 'SECRETPASS'];

let currentUser = JSON.parse(localStorage.getItem('premium_user')) || null;
let selectedDateStr = null;

// 네비게이션
const app = {
    navigate: (viewId) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('view-active'));
        document.getElementById(`view-${viewId}`).classList.add('view-active');
        if (viewId === 'explore') {
            if (!currentUser) return app.navigate('home');
            initCalendar();
        }
    },
    login: async () => {
        const phone = document.getElementById('login-phone').value.trim();
        if(!phone) { alert('가입된 연락처를 입력해주세요.'); return; }
        
        // 기존 회원 확인
        const { data, error } = await supabaseClient
            .from('premium_users')
            .select('*')
            .eq('phone', phone)
            .single();
            
        if (error || !data) {
            alert('일치하는 회원 정보가 없습니다. 초대코드로 가입해주세요.');
        } else {
            currentUser = data;
            localStorage.setItem('premium_user', JSON.stringify(data));
            app.navigate('explore');
        }
    },
    logout: () => {
        currentUser = null;
        localStorage.removeItem('premium_user');
        app.navigate('home');
    }
};

// 가입 처리
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    const referral = document.getElementById('su-referral').value.trim();
    if(!VALID_CODES.includes(referral.toUpperCase())) {
        alert('유효하지 않은 초대 코드입니다. 가입이 불가능합니다.');
        return;
    }
    
    const phone = document.getElementById('su-phone').value.trim();
    const gender = document.querySelector('input[name="gender"]:checked').value;
    const birth = document.getElementById('su-birth').value;
    const location = document.getElementById('su-location').value.trim();
    const occupation = document.getElementById('su-occupation').value.trim();
    
    btn.textContent = '가입 요청 전송 중...';
    btn.disabled = true;
    
    // 중복 가입 체크
    const { data: exist } = await supabaseClient.from('premium_users').select('id').eq('phone', phone);
    if (exist && exist.length > 0) {
        alert('이미 가입된 전화번호입니다.');
        btn.textContent = '가입 승인 요청 (완료)';
        btn.disabled = false;
        return;
    }

    const { data, error } = await supabaseClient.from('premium_users').insert([
        { phone, gender, birth_date: birth, location, occupation, referral_code: referral.toUpperCase() }
    ]).select().single();

    if (error) {
        console.error(error);
        alert('서버 오류가 발생했습니다. 다시 시도해주세요.');
    } else {
        alert('가입이 성공적으로 완료되었습니다! 프라이빗 라운지로 이동합니다.');
        currentUser = data;
        localStorage.setItem('premium_user', JSON.stringify(data));
        app.navigate('explore');
    }
    
    btn.textContent = '가입 승인 요청 (완료)';
    btn.disabled = false;
});

// 캘린더 및 탐색 로직
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

const calMonthTitle = document.getElementById('cal-month-title');
const calGrid = document.getElementById('cal-grid');

function getLocalISODate(d) {
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d - offset)).toISOString().split('T')[0];
}

async function initCalendar() {
    renderCalendar(); // 일단 달력부터 보여줌
    fetchMatchesForMonth(); // DB에서 스케줄 불러오기
}

document.getElementById('cal-prev').addEventListener('click', () => {
    currentMonth--;
    if(currentMonth < 0) { currentMonth = 11; currentYear--; }
    initCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
    currentMonth++;
    if(currentMonth > 11) { currentMonth = 0; currentYear++; }
    initCalendar();
});

let monthlyDatesData = []; // 이성이 만날 수 있는 날짜
let myDatesData = []; // 내가 만날 수 있는 날짜

async function fetchMatchesForMonth() {
    const oppositeGender = currentUser.gender === 'M' ? 'F' : 'M';
    
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
    
    // 1. 이성 데이터
    const { data: opData } = await supabaseClient
        .from('premium_available_dates')
        .select('date')
        .eq('gender', oppositeGender)
        .gte('date', getLocalISODate(startOfMonth))
        .lte('date', getLocalISODate(endOfMonth));
        
    monthlyDatesData = opData ? opData.map(d => d.date) : [];
    
    // 2. 내 데이터
    const { data: myData } = await supabaseClient
        .from('premium_available_dates')
        .select('date')
        .eq('user_id', currentUser.id)
        .gte('date', getLocalISODate(startOfMonth))
        .lte('date', getLocalISODate(endOfMonth));
        
    myDatesData = myData ? myData.map(d => d.date) : [];
    
    renderCalendar();
    
    // 만약 이미 선택된 날짜가 있다면 UI 갱신
    if(selectedDateStr) selectDate(selectedDateStr);
}

function renderCalendar() {
    calMonthTitle.textContent = `${currentYear}. ${String(currentMonth + 1).padStart(2, '0')}`;
    calGrid.innerHTML = '';
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const todayStr = getLocalISODate(new Date());

    // 첫째날 앞 빈칸 채우기
    for(let i=0; i<firstDay; i++) {
        calGrid.innerHTML += `<div class="cal-day"></div>`;
    }
    
    for(let i=1; i<=daysInMonth; i++) {
        const d = new Date(currentYear, currentMonth, i);
        const dStr = getLocalISODate(d);
        
        let classes = ['cal-day', 'active'];
        if(dStr === selectedDateStr) classes.push('selected');
        if(monthlyDatesData.includes(dStr)) classes.push('has-match');
        if(myDatesData.includes(dStr)) classes.push('my-date');
        
        // 과거 날짜는 비활성화
        if (dStr < todayStr) classes = ['cal-day']; 
        
        if (dStr < todayStr) {
            calGrid.innerHTML += `<div class="${classes.join(' ')}">${i}</div>`;
        } else {
            calGrid.innerHTML += `<div class="${classes.join(' ')}" onclick="app.selectDate('${dStr}')">${i}</div>`;
        }
    }
}

app.selectDate = async function(dStr) {
    selectedDateStr = dStr;
    renderCalendar(); 
    
    document.getElementById('selected-date-title').textContent = `${dStr} 라운지`;
    
    const myAvailBtn = document.getElementById('toggle-my-avail-btn');
    myAvailBtn.style.display = 'block';
    
    const iAmAvailable = myDatesData.includes(selectedDateStr);
    myAvailBtn.textContent = iAmAvailable ? '나의 일정 취소하기' : '✔ 나도 이 날 시간 됨';
    myAvailBtn.className = iAmAvailable ? 'btn btn-outline small-btn' : 'btn btn-filled small-btn';
    
    // 해댱 날짜의 이성 리스트 로딩
    const oppositeGender = currentUser.gender === 'M' ? 'F' : 'M';
    const listEl = document.getElementById('match-list');
    listEl.innerHTML = '<p class="empty-state">신원을 확인하고 있습니다...</p>';
    
    // Join 쿼리 (Foreign Key 기반)
    const { data: usersData, error } = await supabaseClient
        .from('premium_available_dates')
        .select(`
            user_id,
            premium_users!inner(
                id, gender, birth_date, location, occupation
            )
        `)
        .eq('date', selectedDateStr)
        .eq('gender', oppositeGender);
        
    if(error || !usersData || usersData.length === 0) {
        listEl.innerHTML = '<p class="empty-state">해당 날짜에 라운지를 예약한 이성이 없습니다.<br>먼저 일정을 등록하고 만남을 기다려보세요.</p>';
        return;
    }
    
    listEl.innerHTML = '';
    usersData.forEach(item => {
        const u = item.premium_users;
        const birthYear = parseInt(u.birth_date.substring(0,4));
        const age = new Date().getFullYear() - birthYear; // 대략적인 만 나이
        
        listEl.innerHTML += `
            <div class="match-card">
                <div class="match-header">
                    <span class="match-job">${u.occupation}</span>
                    <span class="match-age">만 ${age}세</span>
                </div>
                <div class="match-detail">📍 ${u.location}</div>
                <div class="match-detail">성별: ${u.gender === 'F' ? '여성' : '남성'}</div>
            </div>
        `;
    });
};

document.getElementById('toggle-my-avail-btn').addEventListener('click', async () => {
    const iAmAvailable = myDatesData.includes(selectedDateStr);
    
    if(iAmAvailable) {
        // 내 일정에서 삭제
        await supabaseClient.from('premium_available_dates')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('date', selectedDateStr);
            
        myDatesData = myDatesData.filter(d => d !== selectedDateStr);
    } else {
        // 내 일정 등록
        await supabaseClient.from('premium_available_dates').insert([
            { user_id: currentUser.id, gender: currentUser.gender, date: selectedDateStr }
        ]);
        myDatesData.push(selectedDateStr);
    }
    app.selectDate(selectedDateStr); 
});

// 초기 부팅
if(currentUser) {
    app.navigate('explore');
} else {
    app.navigate('home');
}
