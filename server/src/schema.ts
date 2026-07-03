export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS roles (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(80) PRIMARY KEY,
    group_name VARCHAR(80) NOT NULL,
    label VARCHAR(140) NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id CHAR(36) NOT NULL,
    permission_id VARCHAR(80) NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role
      FOREIGN KEY (role_id) REFERENCES roles(id)
      ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission
      FOREIGN KEY (permission_id) REFERENCES permissions(id)
      ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    full_name VARCHAR(140) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id CHAR(36) NOT NULL,
    status ENUM('active', 'passive') NOT NULL DEFAULT 'active',
    failed_login_attempts INT NOT NULL DEFAULT 0,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role
      FOREIGN KEY (role_id) REFERENCES roles(id)
  )`,
  `CREATE TABLE IF NOT EXISTS call_records (
    id CHAR(36) PRIMARY KEY,
    record_number VARCHAR(32) NOT NULL UNIQUE,
    phone_number VARCHAR(32) NOT NULL,
    student_tc VARCHAR(11) NULL,
    student_name VARCHAR(160) NULL,
    interaction_type VARCHAR(80) NOT NULL,
    category VARCHAR(120) NOT NULL,
    sub_category VARCHAR(120) NULL,
    issue TEXT NOT NULL,
    initial_note TEXT NULL,
    priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
    status ENUM('open', 'in_progress', 'waiting', 'follow_up', 'transferred', 'resolved', 'closed', 'cancelled', 'duplicate', 'archived') NOT NULL DEFAULT 'open',
    needs_follow_up TINYINT(1) NOT NULL DEFAULT 0,
    follow_up_at DATETIME NULL,
    opened_by_user_id CHAR(36) NOT NULL,
    assigned_to_user_id CHAR(36) NULL,
    resolved_by_user_id CHAR(36) NULL,
    resolved_at DATETIME NULL,
    resolution_description TEXT NULL,
    resolution_category VARCHAR(120) NULL,
    is_locked TINYINT(1) NOT NULL DEFAULT 0,
    ip_address VARCHAR(80) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_call_records_opened_by (opened_by_user_id),
    INDEX idx_call_records_assigned_to (assigned_to_user_id),
    INDEX idx_call_records_status (status),
    INDEX idx_call_records_created_at (created_at),
    CONSTRAINT fk_call_records_opened_by
      FOREIGN KEY (opened_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_call_records_assigned_to
      FOREIGN KEY (assigned_to_user_id) REFERENCES users(id)
      ON DELETE SET NULL,
    CONSTRAINT fk_call_records_resolved_by
      FOREIGN KEY (resolved_by_user_id) REFERENCES users(id)
      ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS call_notes (
    id CHAR(36) PRIMARY KEY,
    call_id CHAR(36) NOT NULL,
    author_user_id CHAR(36) NOT NULL,
    note_type ENUM('personnel', 'follow_up', 'assigned_personnel', 'internal', 'resolution', 'manager') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_call_notes_call (call_id),
    CONSTRAINT fk_call_notes_call
      FOREIGN KEY (call_id) REFERENCES call_records(id)
      ON DELETE CASCADE,
    CONSTRAINT fk_call_notes_author
      FOREIGN KEY (author_user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS call_events (
    id CHAR(36) PRIMARY KEY,
    call_id CHAR(36) NOT NULL,
    actor_user_id CHAR(36) NULL,
    event_type VARCHAR(80) NOT NULL,
    description VARCHAR(255) NOT NULL,
    metadata JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_call_events_call (call_id),
    CONSTRAINT fk_call_events_call
      FOREIGN KEY (call_id) REFERENCES call_records(id)
      ON DELETE CASCADE,
    CONSTRAINT fk_call_events_actor
      FOREIGN KEY (actor_user_id) REFERENCES users(id)
      ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS call_form_options (
    id CHAR(36) PRIMARY KEY,
    option_type ENUM('interaction_type', 'issue_category') NOT NULL,
    label VARCHAR(140) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_call_form_options_type_label (option_type, label),
    INDEX idx_call_form_options_type_active (option_type, is_active)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id CHAR(36) PRIMARY KEY,
    actor_user_id CHAR(36) NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(120) NULL,
    metadata JSON NULL,
    ip_address VARCHAR(80) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_logs_actor (actor_user_id),
    INDEX idx_audit_logs_entity (entity_type, entity_id),
    CONSTRAINT fk_audit_logs_actor
      FOREIGN KEY (actor_user_id) REFERENCES users(id)
      ON DELETE SET NULL
  )`,
];

export const defaultCallFormOptions = [
  { type: "interaction_type", label: "Gelen çağrı", sortOrder: 10 },
  { type: "interaction_type", label: "Giden çağrı", sortOrder: 20 },
  { type: "interaction_type", label: "WhatsApp görüşmesi", sortOrder: 30 },
  { type: "interaction_type", label: "E-posta dönüşü", sortOrder: 40 },
  { type: "interaction_type", label: "Web form talebi", sortOrder: 50 },
  { type: "interaction_type", label: "Yüz yüze görüşme", sortOrder: 60 },
  { type: "issue_category", label: "Kayıt işlemleri", sortOrder: 10 },
  { type: "issue_category", label: "Ödeme sorunu", sortOrder: 20 },
  { type: "issue_category", label: "İade işlemleri", sortOrder: 30 },
  { type: "issue_category", label: "Belge talebi", sortOrder: 40 },
  { type: "issue_category", label: "Teknik sorun", sortOrder: 50 },
  { type: "issue_category", label: "Bilgi talebi", sortOrder: 60 },
  { type: "issue_category", label: "Randevu talebi", sortOrder: 70 },
  { type: "issue_category", label: "Şikayet", sortOrder: 80 },
  { type: "issue_category", label: "Sistem hatası", sortOrder: 90 },
  { type: "issue_category", label: "Diğer", sortOrder: 100 },
];

export const permissions = [
  {
    id: "calls.view.own",
    groupName: "Çağrı Kayıtları",
    label: "Kendi çağrılarını görüntüle",
    description: "Kullanıcı sadece kendi açtığı çağrı kayıtlarını görebilir.",
  },
  {
    id: "calls.view.all",
    groupName: "Çağrı Kayıtları",
    label: "Tüm çağrıları görüntüle",
    description: "Tüm çağrı kayıtlarını sadece görüntüleme yetkisi verir.",
  },
  {
    id: "calls.create",
    groupName: "Çağrı Kayıtları",
    label: "Yeni çağrı kaydı aç",
    description: "Yeni çağrı kaydı oluşturabilir.",
  },
  {
    id: "calls.edit",
    groupName: "Çağrı Kayıtları",
    label: "Çağrı kaydı düzenle",
    description: "Ana çağrı kayıt bilgilerini düzenleyebilir.",
  },
  {
    id: "calls.note.own",
    groupName: "Notlar",
    label: "Kendi kaydına not ekle",
    description: "Kendi açtığı çağrı kayıtlarına not ekleyebilir.",
  },
  {
    id: "calls.note.assigned",
    groupName: "Notlar",
    label: "Atanan kayda not ekle",
    description: "Kendisine atanmış kayıtlara not ekleyebilir.",
  },
  {
    id: "calls.assign",
    groupName: "Atama",
    label: "Çağrı ataması yap",
    description: "Çağrı kaydını kullanıcı veya departmana atayabilir.",
  },
  {
    id: "calls.resolve",
    groupName: "Çözüm İşlemleri",
    label: "Çağrıyı çözüldü yap",
    description: "Çözüm açıklamasıyla kaydı çözüldü durumuna alabilir.",
  },
  {
    id: "calls.reopen",
    groupName: "Çözüm İşlemleri",
    label: "Çözülen kaydı yeniden aç",
    description: "Kilitlenen çözülen kayıtları yeniden açabilir.",
  },
  {
    id: "calls.archive",
    groupName: "Çözüm İşlemleri",
    label: "Kaydı pasife al",
    description: "Silme yerine kayıtları pasife alabilir veya arşivleyebilir.",
  },
  {
    id: "users.manage",
    groupName: "Kullanıcı Yönetimi",
    label: "Kullanıcıları yönet",
    description: "Kullanıcı oluşturabilir, düzenleyebilir ve rol atayabilir.",
  },
  {
    id: "roles.manage",
    groupName: "Roller ve İzinler",
    label: "Rolleri ve izinleri yönet",
    description: "Panelden rol ekleyebilir ve rol izinlerini değiştirebilir.",
  },
  {
    id: "reports.view",
    groupName: "Raporlar",
    label: "Raporları görüntüle",
    description: "Rapor ekranlarını görüntüleyebilir.",
  },
  {
    id: "reports.export",
    groupName: "Raporlar",
    label: "Rapor dışa aktar",
    description: "Raporları Excel veya PDF olarak dışa aktarabilir.",
  },
  {
    id: "logs.view",
    groupName: "Loglar",
    label: "Log kayıtlarını görüntüle",
    description: "Sistem işlem geçmişini görüntüleyebilir.",
  },
  {
    id: "settings.manage",
    groupName: "Ayarlar",
    label: "Sistem ayarlarını yönet",
    description: "Form, güvenlik ve sistem davranışı ayarlarını yönetebilir.",
  },
  {
    id: "sensitive.view_unmasked",
    groupName: "Hassas Veri",
    label: "Hassas veriyi maskesiz gör",
    description: "TC ve telefon gibi hassas alanları maskesiz görebilir.",
  },
];
