/* Global Application State & SQLite Simulation */
let db = null;
let currentAvatar = {
    name: "Bé Ngoan",
    bodyColor: "#FFBEFB",
    hairStyle: "style1",
    hairColor: "#8C56D4",
    glasses: "none",
    clothes: "#D46743"
};

let questionsData = [
    { term: "Trí tuệ nhân tạo", definition: "Công nghệ mô phỏng quá trình suy nghĩ và học tập của con người bằng máy tính.", distractors: ["Phần cứng máy tính", "Mạch điện tử"] },
    { term: "Thuật toán", definition: "Tập hợp hữu hạn các hướng dẫn từng bước để giải quyết một vấn đề cụ thể.", distractors: ["Mã nguồn mở", "Bảng mạch chủ"] },
    { term: "Điện toán đám mây", definition: "Cung cấp các dịch vụ điện toán qua internet thay vì máy chủ cục bộ.", distractors: ["Ổ cứng di động", "Mạng LAN nội bộ"] },
    { term: "An ninh mạng", definition: "Biện pháp bảo vệ hệ thống, mạng và chương trình khỏi các cuộc tấn công kỹ thuật số.", distractors: ["Tường lửa cơ học", "Trình duyệt web"] },
    { term: "Dữ liệu lớn", definition: "Tập hợp dữ liệu có kích thước rất lớn và phức tạp mà các công cụ truyền thống khó xử lý.", distractors: ["Cơ sở dữ liệu nhỏ", "Tệp văn bản"] }
];

let roomCode = "WORD50";
let roomPlayers = [];
let activeSessionQuestions = [];
let gameTimerInterval = null;
let gameSecondsElapsed = 0;
let currentGameScore = 0;
let matchedPairsCount = 0;

// 3 Background presets for Leaderboard page
const leaderboardBackgrounds = [
    "bg-gradient-to-br from-[#BFE7EA] via-[#BEDEFF] to-[#FFEAD3]",
    "bg-gradient-to-br from-[#FFF2A7] via-[#E5CD82] to-[#E89B5B]",
    "bg-gradient-to-br from-[#DC95FF] via-[#FFBEFB] to-[#BFE7EA]"
];

// Initialize SQLite Database using sql.js and WebAssembly
async function initSQLiteDatabase() {
    try {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        db = new SQL.Database();
        db.run(`
            CREATE TABLE IF NOT EXISTS rooms (
                code TEXT PRIMARY KEY,
                host_name TEXT,
                max_players INTEGER
            );
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_code TEXT,
                name TEXT,
                score INTEGER,
                time_spent INTEGER,
                avatar_data TEXT
            );
            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                term TEXT,
                definition TEXT,
                distractors TEXT
            );
        `);
        questionsData.forEach(q => {
            db.run(`INSERT INTO questions (term, definition, distractors) VALUES (?, ?, ?)`, 
                [q.term, q.definition, JSON.stringify(q.distractors)]);
        });
    } catch (err) {
        console.warn("SQLite WASM initialization fallback:", err);
    }
}

// Initialization
window.onload = function() {
    initSQLiteDatabase();
    updateAvatar();
    renderQuestionsList();
    
    const hash = window.location.hash;
    if (hash && hash.includes('join=')) {
        const codeFromURL = hash.split('join=')[1];
        if (codeFromURL) {
            roomCode = codeFromURL.toUpperCase();
            document.getElementById('room-code-input').value = roomCode;
        }
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room') || urlParams.get('code');
        if (roomParam) {
            roomCode = roomParam.toUpperCase();
            document.getElementById('room-code-input').value = roomCode;
        }
    }

    generateQRCode();
    
    roomPlayers = [
        { name: "Bé Ngoan", score: 0, avatar: {...currentAvatar} },
        { name: "Minh Thư", score: 85, avatar: { bodyColor: "#FFF2A7", hairStyle: "style2", hairColor: "#930031", glasses: "round", clothes: "#728E6D" } },
        { name: "Gia Hân", score: 92, avatar: { bodyColor: "#BEDEFF", hairStyle: "style3", hairColor: "#D46743", glasses: "none", clothes: "#DC95FF" } },
        { name: "Hoàng Long", score: 78, avatar: { bodyColor: "#F2DACE", hairStyle: "style4", hairColor: "#15370D", glasses: "star", clothes: "#7C0E44" } }
    ];
    updateLobbyPlayersUI();
};

// Navigation between pages
function goToPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    window.scrollTo(0, 0);

    if (pageId === 'page-lobby') {
        updateLobbyPlayersUI();
    } else if (pageId === 'page-leaderboard') {
        setupLeaderboardView();
    }
}

// Custom Modal helper
function showModal(title, message, iconClass = "fa-solid fa-bell text-[#FFA500]") {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    document.getElementById('modal-icon').innerHTML = `<i class="${iconClass}"></i>`;
    
    const modal = document.getElementById('custom-modal');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeModal() {
    const content = document.getElementById('modal-content');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        document.getElementById('custom-modal').classList.add('hidden');
    }, 200);
}

// Set Customization parameter from visual swatches
function setCustomParam(param, value, btnElement) {
    currentAvatar[param] = value;
    
    const parent = btnElement.parentElement;
    Array.from(parent.children).forEach(child => {
        child.classList.remove('ring-2', 'ring-[#930031]');
    });
    btnElement.classList.add('ring-2', 'ring-[#930031]');

    updateAvatar();
}

// Avatar Customizer Logic
function updateAvatar() {
    const nameInput = document.getElementById('player-name-input');
    if (nameInput) {
        currentAvatar.name = nameInput.value || "Bé Ngoan";
    }

    const bodyEl = document.getElementById('av-body');
    if (bodyEl) {
        bodyEl.style.backgroundColor = currentAvatar.bodyColor;
        bodyEl.style.borderRadius = '999px';
    }

    const hairBack = document.getElementById('av-hair-back');
    const hairFront = document.getElementById('av-hair-front');
    if (hairBack && hairFront) {
        hairBack.style.backgroundColor = currentAvatar.hairColor;
        hairFront.style.backgroundColor = currentAvatar.hairColor;

        if (currentAvatar.hairStyle === 'style1') {
            hairBack.style.display = 'block';
            hairFront.style.display = 'block';
            hairFront.style.borderRadius = '999px 999px 0 0';
            hairBack.style.height = '80px';
        } else if (currentAvatar.hairStyle === 'style2') {
            hairBack.style.display = 'block';
            hairFront.style.display = 'block';
            hairBack.style.height = '110px';
            hairBack.style.borderRadius = '20px';
        } else if (currentAvatar.hairStyle === 'style3') {
            hairBack.style.display = 'none';
            hairFront.style.display = 'block';
            hairFront.style.width = '40px';
            hairFront.style.height = '30px';
            hairFront.style.borderRadius = '20px';
            hairFront.style.top = '-15px';
        } else if (currentAvatar.hairStyle === 'style4') {
            hairBack.style.display = 'none';
            hairFront.style.display = 'none';
        }
    }

    const glassesEl = document.getElementById('av-glasses');
    if (glassesEl) {
        if (currentAvatar.glasses === 'none') {
            glassesEl.classList.add('hidden');
        } else {
            glassesEl.classList.remove('hidden');
            glassesEl.innerHTML = currentAvatar.glasses === 'star' ? '<i class="fa-solid fa-star text-yellow-400 text-xl drop-shadow"></i>' : '<div class="w-6 h-5 border-2 border-black rounded-full bg-cyan-100/60 shadow-sm"></div><div class="w-2 h-1 bg-black self-center"></div><div class="w-6 h-5 border-2 border-black rounded-full bg-cyan-100/60 shadow-sm"></div>';
        }
    }

    const clothesEl = document.getElementById('av-clothes');
    if (clothesEl) {
        clothesEl.style.backgroundColor = currentAvatar.clothes;
        clothesEl.innerText = currentAvatar.name.slice(0, 5);
    }
}

function renderAvatarHTML(av, sizeClass = "w-10 h-10") {
    let hairHTML = '';
    if (av.hairStyle === 'style1' || av.hairStyle === 'style2') {
        hairHTML = `<div class="absolute -top-1 w-full h-1/2 rounded-t-full z-20" style="background-color: ${av.hairColor}"></div>`;
    } else if (av.hairStyle === 'style3') {
        hairHTML = `<div class="absolute -top-2 w-4 h-3 rounded-full z-20" style="background-color: ${av.hairColor}"></div>`;
    }
    let glassesHTML = av.glasses !== 'none' ? `<div class="absolute top-2.5 flex items-center justify-center gap-0.5 z-30"><div class="w-4 h-3 border border-black rounded-full bg-cyan-100/50"></div><div class="w-1 h-0.5 bg-black"></div><div class="w-4 h-3 border border-black rounded-full bg-cyan-100/50"></div></div>` : '';
    
    let shapeStyle = `background-color: ${av.bodyColor}; border: 2px solid white; border-radius: 999px;`;

    return `
        <div class="${sizeClass} flex items-center justify-center relative overflow-hidden shadow font-['Aptos']" style="${shapeStyle}">
            ${hairHTML}
            <div class="relative z-10 flex flex-col items-center">
                <div class="flex gap-2 mb-1">
                    <div class="w-1 h-1 bg-black rounded-full"></div>
                    <div class="w-1 h-1 bg-black rounded-full"></div>
                </div>
                ${glassesHTML}
                <div class="w-2 h-1 border-b-2 border-[#930031] rounded-full mt-1"></div>
            </div>
            <div class="absolute bottom-0 w-3/4 h-3 rounded-t-lg z-20" style="background-color: ${av.clothes}"></div>
        </div>
    `;
}

function generateQRCode() {
    const container = document.getElementById('qrcode-container');
    if (!container) return;
    container.innerHTML = "";
    
    const currentBaseURL = window.location.href.split('#')[0].split('?')[0];
    const shareableLink = currentBaseURL + "#join=" + roomCode;
    
    const linkLbl = document.getElementById('lbl-room-link');
    if (linkLbl) linkLbl.innerText = shareableLink;

    try {
        new QRCode(container, {
            text: shareableLink,
            width: 48,
            height: 48,
            colorDark: "#15370D",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch(e) {
        container.innerHTML = '<i class="fa-solid fa-qrcode text-2xl text-[#15370D]"></i>';
    }
}

function copyRoomLink() {
    const currentBaseURL = window.location.href.split('#')[0].split('?')[0];
    const linkText = currentBaseURL + "#join=" + roomCode;
    
    const tempInput = document.createElement("input");
    tempInput.value = linkText;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    showModal("Thành Công", "Đã sao chép link phòng chơi vào bộ nhớ tạm!", "fa-solid fa-circle-check text-[#728E6D]");
}

function joinRoom() {
    const inputCode = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (!inputCode) {
        showModal("Lỗi", "Vui lòng nhập mã phòng chơi hợp lệ!", "fa-solid fa-triangle-exclamation text-red-500");
        return;
    }
    roomCode = inputCode;
    document.getElementById('lbl-room-code').innerText = roomCode;
    document.getElementById('lobby-room-title').innerText = "Phòng: " + roomCode;
    document.getElementById('lbl-room-link').innerText = "https://wordgame.edu/join/" + roomCode;
    
    updateAvatar();
    if (!roomPlayers.some(p => p.name === currentAvatar.name)) {
        roomPlayers.unshift({ name: currentAvatar.name, score: 0, avatar: {...currentAvatar} });
    }

    generateQRCode();
    goToPage('page-lobby');
    showModal("Tham Gia Thành Công", `Bạn đã gia nhập phòng ${roomCode} thành công!`, "fa-solid fa-user-check text-[#728E6D]");
}

function startHostRoom() {
    roomCode = "WORD" + Math.floor(100 + Math.random() * 900);
    document.getElementById('lbl-room-code').innerText = roomCode;
    document.getElementById('lobby-room-title').innerText = "Phòng Chủ Trì: " + roomCode;
    document.getElementById('lbl-room-link').innerText = "https://wordgame.edu/join/" + roomCode;
    
    updateAvatar();
    if (!roomPlayers.some(p => p.name === currentAvatar.name)) {
        roomPlayers.unshift({ name: currentAvatar.name, score: 0, avatar: {...currentAvatar} });
    }

    generateQRCode();
    goToPage('page-lobby');
    showModal("Khởi Tạo Phòng", `Tạo phòng thành công với mã ${roomCode}! Đang chờ người chơi tham gia.`, "fa-solid fa-crown text-[#FFA500]");
}

function updateLobbyPlayersUI() {
    const grid = document.getElementById('lobby-players-grid');
    if (!grid) return;
    grid.innerHTML = "";
    roomPlayers.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = "flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-100 shadow-sm";
        item.innerHTML = `
            ${renderAvatarHTML(p.avatar, "w-8 h-8")}
            <div class="overflow-hidden">
                <p class="font-bold text-xs text-[#15370D] truncate">${p.name} ${idx === 0 ? '(Bạn/Chủ)' : ''}</p>
                <span class="text-[10px] text-gray-500">Đang sẵn sàng</span>
            </div>
        `;
        grid.appendChild(item);
    });
    document.getElementById('player-count-badge').innerText = `${roomPlayers.length} / 50`;
    document.getElementById('lobby-question-count').innerText = `${questionsData.length} câu`;
}

function addQuestionDirect() {
    const term = document.getElementById('q-term').value.trim();
    const definition = document.getElementById('q-definition').value.trim();
    const distractorsStr = document.getElementById('q-distractors').value.trim();

    if (!term || !definition) {
        showModal("Thiếu thông tin", "Vui lòng nhập đầy đủ Từ/Cụm từ và Định nghĩa chính xác!", "fa-solid fa-triangle-exclamation text-red-500");
        return;
    }

    const distractors = distractorsStr ? distractorsStr.split(',').map(s => s.trim()).filter(s => s) : ["Từ nhiễu 1", "Từ nhiễu 2"];
    questionsData.push({ term, definition, distractors });

    document.getElementById('q-term').value = "";
    document.getElementById('q-definition').value = "";
    document.getElementById('q-distractors').value = "";

    renderQuestionsList();
    showModal("Thành Công", "Đã thêm câu hỏi mới vào danh sách!", "fa-solid fa-circle-check text-[#728E6D]");
}

function renderQuestionsList() {
    const container = document.getElementById('questions-container');
    if (!container) return;
    container.innerHTML = "";
    document.getElementById('question-list-count').innerText = questionsData.length;

    questionsData.forEach((q, idx) => {
        const div = document.createElement('div');
        div.className = "p-3 bg-white rounded-xl border border-gray-200 flex justify-between items-center text-xs";
        div.innerHTML = `
            <div>
                <span class="font-bold text-[#930031]">${idx + 1}. ${q.term}</span>: <span class="text-gray-700">${q.definition}</span>
                <div class="text-[10px] text-gray-500 mt-1">Từ nhiễu: ${q.distractors.join(', ')}</div>
            </div>
            <button onclick="removeQuestion(${idx})" class="text-red-500 hover:text-red-700 p-1"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(div);
    });
}

function removeQuestion(idx) {
    questionsData.splice(idx, 1);
    renderQuestionsList();
}

function clearAllQuestions() {
    questionsData = [];
    renderQuestionsList();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('file-upload-status').innerText = file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            if (file.name.endsWith('.json')) {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    questionsData = questionsData.concat(parsed);
                }
            } else {
                const lines = content.split('\n');
                lines.forEach(line => {
                    const parts = line.split('|');
                    if (parts.length >= 2) {
                        questionsData.push({
                            term: parts[0].trim(),
                            definition: parts[1].trim(),
                            distractors: parts[2] ? parts[2].split(',').map(s => s.trim()) : ["Nhiễu A", "Nhiễu B"]
                        });
                    }
                });
            }
            renderQuestionsList();
            showModal("Tải File Thành Công", `Đã nhập câu hỏi từ file ${file.name} thành công!`, "fa-solid fa-file-arrow-up text-[#728E6D]");
        } catch(err) {
            showModal("Lỗi Đọc File", "Không thể đọc định dạng file. Vui lòng kiểm tra lại cấu trúc file!", "fa-solid fa-triangle-exclamation text-red-500");
        }
    };
    reader.readAsText(file);
}

let currentQuestionIndex = 0;
let gameScore = 0;

function startGameSession() {
    if (questionsData.length === 0) {
        showModal("Chưa có câu hỏi", "Vui lòng tạo ít nhất 1 câu hỏi trước khi bắt đầu trò chơi!", "fa-solid fa-triangle-exclamation text-red-500");
        return;
    }

    activeSessionQuestions = [...questionsData];
    currentQuestionIndex = 0;
    gameScore = 0;
    matchedPairsCount = 0;
    gameSecondsElapsed = 0;

    document.getElementById('game-player-name-display').innerText = currentAvatar.name;
    const miniAvatar = document.getElementById('game-player-avatar-mini');
    miniAvatar.outerHTML = `<div id="game-player-avatar-mini">${renderAvatarHTML(currentAvatar, "w-10 h-10")}</div>`;

    goToPage('page-game');
    startTimer();
    loadGameQuestion();
}

function startTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    gameTimerInterval = setInterval(() => {
        gameSecondsElapsed++;
        const mins = String(Math.floor(gameSecondsElapsed / 60)).padStart(2, '0');
        const secs = String(gameSecondsElapsed % 60).padStart(2, '0');
        document.getElementById('game-timer').innerText = `${mins}:${secs}`;
    }, 1000);
}

function loadGameQuestion() {
    if (currentQuestionIndex >= activeSessionQuestions.length) {
        finishGameSession();
        return;
    }

    document.getElementById('game-progress-indicator').innerText = `Câu ${currentQuestionIndex + 1}/${activeSessionQuestions.length}`;
    document.getElementById('game-score').innerText = gameScore;

    const currentQ = activeSessionQuestions[currentQuestionIndex];

    const defContainer = document.getElementById('definitions-list');
    defContainer.innerHTML = `
        <div class="bg-[#FFEAD3]/50 p-4 rounded-2xl border-2 border-[#E89B5B] flex flex-col sm:flex-row justify-between items-center gap-4">
            <div class="flex-1">
                <span class="text-xs font-bold text-[#930031] uppercase">Định Nghĩa Chính Xác:</span>
                <p class="text-sm font-semibold text-[#15370D] mt-1">${currentQ.definition}</p>
            </div>
            <div id="drop-target" class="w-full sm:w-48 h-14 bg-white border-2 border-dashed border-[#728E6D] rounded-xl flex items-center justify-center text-xs text-gray-400 font-semibold drop-zone font-['Aptos']" ondragover="allowDrop(event)" ondragleave="dragLeave(event)" ondrop="dropTerm(event, '${currentQ.term}')">
                Thả từ đúng vào đây
            </div>
        </div>
    `;

    const poolContainer = document.getElementById('draggable-terms-pool');
    poolContainer.innerHTML = "";
    
    let allTerms = [currentQ.term, ...(currentQ.distractors || [])];
    allTerms.sort(() => Math.random() - 0.5);

    allTerms.forEach(term => {
        const badge = document.createElement('div');
        badge.className = "draggable-item px-4 py-2.5 bg-white hover:bg-[#BFE7EA] text-[#15370D] font-bold text-xs rounded-xl shadow border-2 border-[#E89B5B] transition-all font-['Aptos']";
        badge.draggable = true;
        badge.innerText = term;
        badge.id = "term-" + Math.random().toString(36).substring(7);
        
        badge.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', term);
        });

        badge.addEventListener('click', () => {
            checkAnswer(term, currentQ.term);
        });

        poolContainer.appendChild(badge);
    });
}

function allowDrop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.add('drag-over');
}

function dragLeave(ev) {
    ev.currentTarget.classList.remove('drag-over');
}

function dropTerm(ev, correctTerm) {
    ev.preventDefault();
    const droppedText = ev.dataTransfer.getData('text/plain');
    ev.currentTarget.classList.remove('drag-over');
    checkAnswer(droppedText, correctTerm);
}

function checkAnswer(selectedTerm, correctTerm) {
    if (selectedTerm === correctTerm) {
        gameScore += Math.max(10, 50 - gameSecondsElapsed);
        matchedPairsCount++;
        showModal("Chính Xác! 🎉", "Bạn đã ghép từ chính xác tuyệt đối!", "fa-solid fa-circle-check text-[#728E6D]");
    } else {
        gameScore = Math.max(0, gameScore - 5);
        showModal("Chưa Chính Xác", `Từ bạn chọn chưa đúng. Đáp án chính xác là: "${correctTerm}"`, "fa-solid fa-triangle-exclamation text-[#D46743]");
    }

    currentQuestionIndex++;
    setTimeout(() => {
        closeModal();
        loadGameQuestion();
    }, 1200);
}

function finishGameSession() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);

    const existingUser = roomPlayers.find(p => p.name === currentAvatar.name);
    if (existingUser) {
        existingUser.score = gameScore;
        existingUser.time = gameSecondsElapsed;
    } else {
        roomPlayers.push({ name: currentAvatar.name, score: gameScore, time: gameSecondsElapsed, avatar: {...currentAvatar} });
    }

    goToPage('page-leaderboard');
}

function setupLeaderboardView() {
    const randomBg = leaderboardBackgrounds[Math.floor(Math.random() * leaderboardBackgrounds.length)];
    const bgWrapper = document.getElementById('leaderboard-bg-wrapper');
    bgWrapper.className = `flex-1 flex flex-col rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden transition-all duration-700 border-4 border-white ${randomBg}`;

    roomPlayers.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.time || 999) - (b.time || 999);
    });

    for (let i = 1; i <= 3; i++) {
        const player = roomPlayers[i - 1];
        const avatarContainer = document.getElementById(`podium-avatar-${i}`);
        const nameEl = document.getElementById(`podium-name-${i}`);
        const scoreEl = document.getElementById(`podium-score-${i}`);

        if (player) {
            avatarContainer.innerHTML = renderAvatarHTML(player.avatar, "w-14 h-14");
            nameEl.innerText = player.name;
            scoreEl.innerText = `${player.score}đ`;
        } else {
            avatarContainer.innerHTML = `<div class="w-8 h-8 rounded-full bg-gray-200"></div>`;
            nameEl.innerText = "Trống";
            scoreEl.innerText = "0đ";
        }
    }

    const listContainer = document.getElementById('leaderboard-list');
    listContainer.innerHTML = "";

    if (roomPlayers.length <= 3) {
        listContainer.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Tất cả người chơi xuất sắc đều đã đứng trên bục vinh quang!</p>`;
        return;
    }

    roomPlayers.slice(3).forEach((p, idx) => {
        const rank = idx + 4;
        const row = document.createElement('div');
        row.className = "flex items-center justify-between p-3 bg-white/80 rounded-xl border border-gray-100 shadow-sm text-xs";
        row.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="font-black text-[#930031] w-6 text-center">#${rank}</span>
                ${renderAvatarHTML(p.avatar, "w-8 h-8")}
                <span class="font-bold text-[#15370D]">${p.name}</span>
            </div>
            <div class="flex items-center gap-4">
                <span class="text-gray-500 text-[11px]">Thời gian: ${p.time || 0}s</span>
                <span class="font-black text-[#D46743] bg-[#FFEAD3] px-3 py-1 rounded-lg">${p.score} điểm</span>
            </div>
        `;
        listContainer.appendChild(row);
    });
}

function restartGame() {
    goToPage('page-home');
}