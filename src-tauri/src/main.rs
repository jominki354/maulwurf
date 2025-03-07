#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::path::Path;
use serde::Serialize;
use std::sync::Mutex;
use std::collections::VecDeque;
use std::io::Write;
use std::panic;
use std::fs::OpenOptions;
use std::sync::mpsc::{channel, Sender, Receiver};
use std::thread;
use tauri::Manager;

#[cfg(target_os = "windows")]
use winapi::um::fileapi::{GetFileAttributesW};
#[cfg(target_os = "windows")]
use winapi::um::winnt::{FILE_ATTRIBUTE_HIDDEN};
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

// 로그 메시지를 저장할 전역 변수
struct LogState {
    messages: VecDeque<LogMessage>,
    terminal_sender: Option<Sender<String>>,
    last_messages: VecDeque<(String, String)>, // 최근 메시지 저장 (level, message)
}

#[derive(Clone, Serialize)]
struct LogMessage {
    level: String,
    message: String,
    timestamp: String,
}

impl LogState {
    fn new() -> Self {
        Self {
            messages: VecDeque::with_capacity(1000), // 최대 1000개 메시지 저장
            terminal_sender: None,
            last_messages: VecDeque::with_capacity(10), // 최근 10개 메시지 저장
        }
    }

    fn add_message(&mut self, level: &str, message: &str) {
        // 중복 로그 방지
        let message_key = (level.to_string(), message.to_string());
        if self.is_duplicate_message(level, message) {
            return; // 중복 메시지는 추가하지 않음
        }
        
        // 중요하지 않은 로그 필터링
        if !self.is_important_log(level, message) {
            return; // 중요하지 않은 로그는 추가하지 않음
        }
        
        // 최근 메시지 목록 업데이트
        if self.last_messages.len() >= 10 {
            self.last_messages.pop_front();
        }
        self.last_messages.push_back(message_key);
        
        let now = chrono::Local::now();
        let timestamp = now.format("%Y-%m-%d %H:%M:%S").to_string();
        
        let log_message = LogMessage {
            level: level.to_string(),
            message: message.to_string(),
            timestamp,
        };
        
        // 최대 크기를 초과하면 가장 오래된 메시지 제거
        if self.messages.len() >= 1000 {
            self.messages.pop_front();
        }
        
        self.messages.push_back(log_message);
        
        // 터미널 로그 전송 (있는 경우)
        if let Some(sender) = &self.terminal_sender {
            let _ = sender.send(format!("[{}] {}", level, message));
        }
    }

    fn get_messages(&self) -> Vec<LogMessage> {
        self.messages.iter().cloned().collect()
    }
    
    fn set_terminal_sender(&mut self, sender: Sender<String>) {
        self.terminal_sender = Some(sender);
    }
    
    // 중복 메시지 확인
    fn is_duplicate_message(&self, level: &str, message: &str) -> bool {
        let message_key = (level.to_string(), message.to_string());
        self.last_messages.contains(&message_key)
    }
    
    // 중요한 로그인지 확인
    fn is_important_log(&self, level: &str, message: &str) -> bool {
        // 오류 및 경고는 항상 중요
        if level == "error" || level == "warning" || level == "fatal" {
            return true;
        }
        
        // 앱 초기화 관련 반복 로그 필터링
        if message.contains("앱 초기화") && 
           self.messages.iter().any(|log| log.message.contains("앱 초기화")) {
            return false;
        }
        
        // 사용자 입력 관련 로그
        if message.contains("입력") || message.contains("클릭") || message.contains("선택") {
            return true;
        }
        
        // 파일 작업 관련 로그
        if message.contains("파일") || message.contains("저장") || message.contains("열기") {
            return true;
        }
        
        // 실행 관련 로그
        if message.contains("실행") || message.contains("시작") || message.contains("종료") {
            return true;
        }
        
        // 디버그 레벨은 중요하지 않음
        if level == "debug" {
            return false;
        }
        
        // 기본적으로 info 레벨은 중요
        level == "info"
    }
}

// 전역 로그 상태 관리
lazy_static::lazy_static! {
    static ref LOG_STATE: Mutex<LogState> = Mutex::new(LogState::new());
}

// 앱 핸들 저장을 위한 전역 변수
lazy_static::lazy_static! {
    static ref APP_HANDLE: Mutex<Option<tauri::AppHandle>> = Mutex::new(None);
}

// 로그 파일 경로 가져오기
fn get_log_file_path() -> std::path::PathBuf {
    let mut path = std::env::current_exe().unwrap_or_default();
    path.pop(); // 실행 파일 이름 제거
    path.push("maulwurf_log.txt");
    path
}

// 파일에 로그 기록
fn log_to_file(level: &str, message: &str) {
    let log_path = get_log_file_path();
    
    let now = chrono::Local::now();
    let timestamp = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let log_entry = format!("[{}] [{}] {}\n", timestamp, level, message);
    
    let mut file = match OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path) {
            Ok(file) => file,
            Err(e) => {
                eprintln!("로그 파일 열기 실패: {}", e);
                return;
            }
        };
    
    if let Err(e) = file.write_all(log_entry.as_bytes()) {
        eprintln!("로그 파일 쓰기 실패: {}", e);
    }
}

// 로그 추가 함수 수정
fn add_log(level: &str, message: &str) {
    // 중요한 로그만 콘솔에 출력
    if is_important_console_log(level, message) {
        println!("LOG: [{}] {}", level, message);
    }
    
    // 메모리 로그에 추가
    if let Ok(mut state) = LOG_STATE.lock() {
        state.add_message(level, message);
    }
    
    // 파일에 로그 기록
    log_to_file(level, message);
    
    // 앱 핸들이 있으면 이벤트 발생
    if let Some(app_handle) = APP_HANDLE.lock().ok().and_then(|h| h.clone()) {
        // Manager 트레이트를 사용하여 이벤트 발생
        let _ = app_handle.emit_all("terminal-log", LogMessage {
            level: level.to_string(),
            message: message.to_string(),
            timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        });
    }
}

// 콘솔에 출력할 중요한 로그인지 확인
fn is_important_console_log(level: &str, message: &str) -> bool {
    // 오류 및 경고는 항상 중요
    if level == "error" || level == "warning" || level == "fatal" {
        return true;
    }
    
    // 앱 초기화 관련 로그는 한 번만 출력
    static mut APP_INIT_LOGGED: bool = false;
    if message.contains("앱 초기화") {
        unsafe {
            if APP_INIT_LOGGED {
                return false;
            }
            APP_INIT_LOGGED = true;
        }
    }
    
    // 터미널 로그 관련 메시지는 출력하지 않음
    if message.contains("터미널 로그") {
        return false;
    }
    
    // 사용자 입력 관련 로그
    if message.contains("입력") || message.contains("클릭") || message.contains("선택") {
        return true;
    }
    
    // 파일 작업 관련 로그
    if message.contains("파일") || message.contains("저장") || message.contains("열기") {
        return true;
    }
    
    // 실행 관련 로그
    if message.contains("실행") || message.contains("시작") || message.contains("종료") {
        return true;
    }
    
    // 디버그 레벨은 출력하지 않음
    if level == "debug" {
        return false;
    }
    
    // 기본적으로 info 레벨은 중요
    level == "info"
}

// 로그 메시지 가져오기 명령
#[tauri::command]
fn get_logs() -> Vec<LogMessage> {
    if let Ok(state) = LOG_STATE.lock() {
        state.get_messages()
    } else {
        Vec::new()
    }
}

// 로그 추가 명령
#[tauri::command]
fn add_log_message(level: &str, message: &str) {
    add_log(level, message);
}

// 터미널 로그 가져오기 명령
#[tauri::command]
fn get_terminal_logs() -> Vec<String> {
    // 현재는 빈 배열 반환, 실제 구현은 메인 함수에서 처리
    Vec::new()
}

// 파일 엔트리 구조체
#[derive(Serialize, Clone)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    hidden: bool,
}

// 윈도우에서 파일이 숨김 상태인지 확인하는 함수
#[cfg(target_os = "windows")]
fn is_hidden_windows(path: &Path) -> bool {
    use std::ffi::OsStr;
    let wide_path: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    
    unsafe {
        let attributes = GetFileAttributesW(wide_path.as_ptr());
        if attributes == u32::MAX {
            return false;
        }
        (attributes & FILE_ATTRIBUTE_HIDDEN) != 0
    }
}

// 윈도우가 아닌 시스템에서의 숨김 파일 확인 (항상 false 반환)
#[cfg(not(target_os = "windows"))]
fn is_hidden_windows(_path: &Path) -> bool {
    false
}

// 디렉토리 내용을 읽는 명령 - 안정성 개선
#[tauri::command]
fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(&path);
    
    println!("디렉토리 읽기 시도: {}", path.display());
    add_log("info", &format!("디렉토리 읽기 시도: {}", path.display()));
    
    // 드라이브 루트인지 확인 (예: "C:\")
    let is_drive_root = path.to_string_lossy().to_string().matches(r"^[A-Z]:\\$").count() > 0;
    
    if is_drive_root {
        println!("드라이브 루트 접근: {}", path.display());
        add_log("info", &format!("드라이브 루트 접근: {}", path.display()));
        
        // 드라이브 루트인 경우 특별 처리
        return read_drive_root(path);
    }
    
    if !path.exists() {
        let error_msg = format!("경로가 존재하지 않습니다: {}", path.display());
        add_log("error", &error_msg);
        return Err(error_msg);
    }
    
    if !path.is_dir() {
        let error_msg = format!("경로가 디렉토리가 아닙니다: {}", path.display());
        add_log("error", &error_msg);
        return Err(error_msg);
    }
    
    // 안전하게 디렉토리 읽기 시도
    match safe_read_dir(path) {
        Ok(entries) => {
            // 성공적으로 읽었으면 로그만 남김
            add_log("info", &format!("디렉토리 읽기 성공: {} (항목 수: {})", path.display(), entries.len()));
            Ok(entries)
        },
        Err(e) => {
            add_log("error", &format!("디렉토리 읽기 실패: {}: {}", path.display(), e));
            Err(e)
        }
    }
}

// 드라이브 루트 읽기 (예: "C:\")
fn read_drive_root(path: &Path) -> Result<Vec<FileEntry>, String> {
    let drive_letter = path.to_string_lossy().chars().next().unwrap_or('C');
    
    // 드라이브 루트 경로 (예: "C:\")
    let root_path = format!("{}:\\", drive_letter);
    
    println!("드라이브 루트 접근 요청: {}", root_path);
    add_log("info", &format!("드라이브 루트 접근 요청: {}", root_path));
    
    // 성능 및 안정성을 위해 기본 Windows 폴더 목록 반환
    let default_folders = vec![
        FileEntry {
            name: "Program Files".to_string(),
            path: format!("{}:\\Program Files", drive_letter),
            is_dir: true,
            hidden: false,
        },
        FileEntry {
            name: "Program Files (x86)".to_string(),
            path: format!("{}:\\Program Files (x86)", drive_letter),
            is_dir: true,
            hidden: false,
        },
        FileEntry {
            name: "Users".to_string(),
            path: format!("{}:\\Users", drive_letter),
            is_dir: true,
            hidden: false,
        },
        FileEntry {
            name: "Windows".to_string(),
            path: format!("{}:\\Windows", drive_letter),
            is_dir: true,
            hidden: false,
        },
    ];
    
    add_log("info", &format!("드라이브 루트 기본 폴더 목록 반환: {} (항목 수: {})", root_path, default_folders.len()));
    Ok(default_folders)
}

// 안전하게 디렉토리 읽기 (오류 처리 포함)
fn safe_read_dir(path: &Path) -> Result<Vec<FileEntry>, String> {
    // 타임아웃 설정 (실제로는 Rust에서 직접적인 타임아웃 설정이 어려움)
    // 대신 안전하게 읽기 시도
    
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(e) => {
            let error_msg = format!("디렉토리 읽기 오류: {}: {}", path.display(), e);
            add_log("error", &error_msg);
            return Err(error_msg);
        }
    };
    
    let mut file_entries = Vec::new();
    
    // 각 항목 처리
    for entry in entries {
        match entry {
            Ok(entry) => {
                let path = entry.path();
                let file_name = match path.file_name() {
                    Some(name) => name.to_string_lossy().to_string(),
                    None => continue, // 파일 이름이 없으면 건너뜀
                };
                
                // 숨김 파일 여부 확인
                let hidden = is_hidden_windows(&path);
                
                // 디렉토리 여부 확인
                let is_dir = match path.is_dir() {
                    true => true,
                    false => false,
                };
                
                file_entries.push(FileEntry {
                    name: file_name,
                    path: path.to_string_lossy().to_string(),
                    is_dir,
                    hidden,
                });
            },
            Err(_) => continue, // 오류가 있는 항목은 건너뜀
        }
    }
    
    // 결과 반환
    Ok(file_entries)
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn is_directory(path: &str) -> bool {
    Path::new(path).is_dir()
}

#[tauri::command]
fn get_dropped_file_path(file_path: &str) -> String {
    file_path.to_string()
}

fn main() {
    // 터미널 로그 캡처를 위한 채널 생성
    let (tx, rx): (Sender<String>, Receiver<String>) = channel();
    
    // 로그 상태에 터미널 로그 전송자 설정
    if let Ok(mut state) = LOG_STATE.lock() {
        state.set_terminal_sender(tx.clone());
    }
    
    // 패닉 핸들러 설정
    panic::set_hook(Box::new(|panic_info| {
        let message = format!("애플리케이션 패닉: {}", panic_info);
        add_log("fatal", &message);
    }));
    
    // 터미널 로그 수신 및 처리 스레드
    thread::spawn(move || {
        // 최근 로그 메시지를 저장하는 집합
        let mut recent_logs = std::collections::HashSet::new();
        
        while let Ok(log_message) = rx.recv() {
            // 중복 로그 방지
            if recent_logs.contains(&log_message) {
                continue;
            }
            
            // 최근 로그 목록 관리 (최대 20개)
            recent_logs.insert(log_message.clone());
            if recent_logs.len() > 20 {
                // 가장 오래된 로그 제거 (HashSet에서는 어렵기 때문에 전체 초기화)
                recent_logs.clear();
                recent_logs.insert(log_message.clone());
            }
            
            // 중요한 로그만 출력
            if !log_message.contains("앱 초기화") && !log_message.contains("터미널 로그") {
                println!("터미널 로그: {}", log_message);
            }
        }
    });
    
    // 시작 로그
    add_log("info", "애플리케이션 시작");
    
    // Tauri 앱 실행
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            is_directory,
            get_dropped_file_path,
            read_dir,
            add_log_message,
            get_logs,
            get_terminal_logs
        ])
        .setup(|app| {
            // 앱 핸들 저장
            if let Ok(mut handle) = APP_HANDLE.lock() {
                *handle = Some(app.handle());
            }
            
            // 로그 파일 경로 출력
            let log_path = get_log_file_path();
            println!("로그 파일 경로: {:?}", log_path);
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri 앱 실행 중 오류 발생");
    
    // 종료 로그
    add_log("info", "애플리케이션 종료");
} 