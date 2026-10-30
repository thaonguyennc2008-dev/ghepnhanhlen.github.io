-- SQLite Database Schema for Word Matching Game (Multiplayer & Room Management)

CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY,
    host_name TEXT NOT NULL,
    max_players INTEGER DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL,
    name TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    avatar_data TEXT, -- JSON string representing avatar customizations (bodyColor, hairStyle, hairColor, glasses, clothes)
    FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    distractors TEXT -- JSON array or comma separated distractors
);

-- Seed initial room and questions
INSERT OR IGNORE INTO rooms (code, host_name, max_players) VALUES ('WORD50', 'Chủ Phòng Mẫu', 50);

INSERT INTO questions (term, definition, distractors) VALUES 
('Trí tuệ nhân tạo', 'Công nghệ mô phỏng quá trình suy nghĩ và học tập của con người bằng máy tính.', '["Phần cứng máy tính", "Mạch điện tử"]'),
('Thuật toán', 'Tập hợp hữu hạn các hướng dẫn từng bước để giải quyết một vấn đề cụ thể.', '["Mã nguồn mở", "Bảng mạch chủ"]'),
('Điện toán đám mây', 'Cung cấp các dịch vụ điện toán qua internet thay vì máy chủ cục bộ.', '["Ổ cứng di động", "Mạng LAN nội bộ"]'),
('An ninh mạng', 'Biện pháp bảo vệ hệ thống, mạng và chương trình khỏi các cuộc tấn công kỹ thuật số.', '["Tường lửa cơ học", "Trình duyệt web"]'),
('Dữ liệu lớn', 'Tập hợp dữ liệu có kích thước rất lớn và phức tạp mà các công cụ truyền thống khó xử lý.', '["Cơ sở dữ liệu nhỏ", "Tệp văn bản"]');