const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isPlaceholder =
  !supabaseUrl ||
  supabaseUrl.includes("your-project-id") ||
  !supabaseAnonKey ||
  supabaseAnonKey.length < 50 || // Une vraie clé Supabase est toujours longue (>50 caractères)
  supabaseAnonKey === "sb_publishable";

let supabase;
let supabaseAdmin;

if (isPlaceholder) {
  console.log("===================================================");
  console.log("⚠️ AVERTISSEMENT : Identifiants Supabase non configurés.");
  console.log("🚀 Activation automatique du MODE SIMULATION (MOCK MODE).");
  console.log("===================================================");

  // In-memory database store
  const db = {
    profiles: [
      {
        id: "00000000-0000-0000-0000-000000000000",
        email: "admin@admin.com",
        role: "admin",
        full_name: "Super Administrateur",
        phone: "+21260000000",
      },
      {
        id: "prom1",
        email: "promoteur@example.com",
        role: "promoteur",
        full_name: "Ahmed Promoteur",
        phone: "+21261111111",
      },
      {
        id: "eng1",
        email: "jean.dupont@chantier.com",
        role: "ingenieur",
        full_name: "Jean Dupont",
        phone: "+21262222222",
      },
      {
        id: "comm1",
        email: "amine.bennani@immo.ma",
        role: "commercial",
        full_name: "Amine Bennani",
        phone: "+21263333333",
      },
      {
        id: "cli1",
        email: "client@example.com",
        role: "client",
        full_name: "Youssef Client",
        phone: "+21264444444",
      },
    ],
    projects: [
      {
        id: "proj-1",
        name: "Résidence Al Massira",
        description: "Immeuble résidentiel haut standing",
        location: "Casablanca",
        latitude: 33.5731,
        longitude: -7.5898,
        status: "construction",
        promoter_name: "Ahmed Promoteur",
        constructor_name: "BTP Maroc Construction",
        target_completion_date: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 365,
        ).toISOString(),
        global_progress: 45.0,
        created_at: new Date().toISOString(),
      },
      {
        id: "proj-2",
        name: "Villas Marina",
        description: "Complexe de villas de luxe en bord de mer",
        location: "Rabat",
        latitude: 34.0208,
        longitude: -6.8416,
        status: "planning",
        promoter_name: "Ahmed Promoteur",
        constructor_name: "Alliances Immo",
        target_completion_date: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 400,
        ).toISOString(),
        global_progress: 0.0,
        created_at: new Date().toISOString(),
      },
    ],
    project_assignments: [
      { project_id: "proj-1", profile_id: "eng1", assigned_role: "ingenieur" },
      {
        project_id: "proj-1",
        profile_id: "comm1",
        assigned_role: "commercial",
      },
    ],
    engineers: [
      {
        id: "eng1",
        full_name: "Jean Dupont",
        role: "ingenieur",
        email: "jean.dupont@chantier.com",
      },
    ],
    project_engineers: [{ project_id: "proj-1", engineer_id: "eng1" }],
    lots: [
      {
        id: "lot-101",
        project_id: "proj-1",
        number: "101",
        type: "F3",
        status: "available",
        price: 1200000,
        client_id: null,
        commercial_id: null,
        created_at: new Date().toISOString(),
      },
      {
        id: "lot-102",
        project_id: "proj-1",
        number: "102",
        type: "F4",
        status: "reserved",
        price: 1800000,
        client_id: "cli1",
        commercial_id: "comm1",
        created_at: new Date().toISOString(),
      },
      {
        id: "lot-201",
        project_id: "proj-2",
        number: "Villa 1",
        type: "Villa",
        status: "available",
        price: 3500000,
        client_id: null,
        commercial_id: null,
        created_at: new Date().toISOString(),
      },
    ],
    milestones: [
      {
        id: "mil-1",
        project_id: "proj-1",
        title: "Fondations",
        description: "Coulage de la dalle de fondation et sous-sol",
        progress_percent: 100,
        is_validated: true,
        order_index: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: "mil-2",
        project_id: "proj-1",
        title: "Gros Œuvre",
        description: "Élévation des murs et des planchers",
        progress_percent: 60,
        is_validated: false,
        order_index: 2,
        created_at: new Date().toISOString(),
      },
    ],
    payments: [
      {
        id: "pay-1",
        lot_id: "lot-102",
        client_id: "cli1",
        amount: 180000,
        status: "paid",
        due_date: "2026-06-15",
        paid_at: new Date().toISOString(),
        receipt_url: "http://192.168.1.5:5000/api/documents/mock",
      },
      {
        id: "pay-2",
        lot_id: "lot-102",
        client_id: "cli1",
        amount: 540000,
        status: "overdue",
        due_date: "2026-07-20",
        paid_at: null,
        receipt_url: null,
      },
      {
        id: "pay-3",
        lot_id: "lot-102",
        client_id: "cli1",
        amount: 1080000,
        status: "pending",
        due_date: "2026-09-10",
        paid_at: null,
        receipt_url: null,
      },
    ],
    documents: [
      {
        id: "doc-1",
        title: "Contrat de Réservation - Lot 102",
        client_id: "cli1",
        type: "reservation",
        file_url: "http://192.168.1.5:5000/api/documents/mock",
        created_at: new Date().toISOString(),
      },
    ],
    snag_issues: [
      {
        id: "snag-1",
        lot_id: "lot-102",
        title: "Fissure mur salon",
        description: "Légère fissure près de la fenêtre principale",
        status: "open",
        severity: "medium",
        subcontractor: "BTP Maroc",
        created_by: "cli1",
        created_at: new Date().toISOString(),
      },
      {
        id: "snag-2",
        lot_id: "lot-102",
        title: "Robinetterie cuisine",
        description: "Robinet d'eau chaude mal fixé",
        status: "resolved",
        severity: "low",
        subcontractor: "Plomberie Express",
        created_by: "cli1",
        created_at: new Date().toISOString(),
      },
    ],
    tasks: [
      {
        id: "task-1",
        project_id: "proj-1",
        parent_id: null,
        level: 1,
        title: "Gros Œuvre (Bloc A)",
        progress_percentage: 60.0,
        target_date: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 30,
        ).toISOString(),
        last_updated_at: new Date().toISOString(),
        description:
          "Vérifier la conformité du béton armé pour la dalle du R+1.",
        status: "in_progress",
        assigned_to: "eng1",
        created_by: "prom1",
        created_at: new Date().toISOString(),
      },
      {
        id: "task-1-1",
        project_id: "proj-1",
        parent_id: "task-1",
        level: 2,
        title: "Fondations & Dalle",
        progress_percentage: 100.0,
        target_date: new Date(
          Date.now() - 1000 * 60 * 60 * 24 * 10,
        ).toISOString(),
        last_updated_at: new Date().toISOString(),
        description: "Couler la dalle principale de fondation.",
        status: "done",
        assigned_to: "eng1",
        created_by: "prom1",
        created_at: new Date().toISOString(),
      },
      {
        id: "task-1-2",
        project_id: "proj-1",
        parent_id: "task-1",
        level: 2,
        title: "Élévation des murs R+1",
        progress_percentage: 20.0,
        target_date: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 15,
        ).toISOString(),
        last_updated_at: new Date().toISOString(),
        description: "Monter les briques et poteaux du Bloc A.",
        status: "in_progress",
        assigned_to: "eng1",
        created_by: "prom1",
        created_at: new Date().toISOString(),
      },
      {
        id: "task-1-2-1",
        project_id: "proj-1",
        parent_id: "task-1-2",
        level: 3,
        title: "Coulage béton poteaux",
        progress_percentage: 30.0,
        target_date: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 5,
        ).toISOString(),
        last_updated_at: new Date().toISOString(),
        description:
          "Vibration et coulage du béton pour les 8 poteaux porteurs.",
        status: "in_progress",
        assigned_to: "eng1",
        created_by: "prom1",
        created_at: new Date().toISOString(),
      },
      {
        id: "task-1-2-2",
        project_id: "proj-1",
        parent_id: "task-1-2",
        level: 3,
        title: "Pose armatures acier",
        progress_percentage: 10.0,
        target_date: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 10,
        ).toISOString(),
        last_updated_at: new Date().toISOString(),
        description: "Ferraillage et ligature des aciers.",
        status: "todo",
        assigned_to: "eng1",
        created_by: "prom1",
        created_at: new Date().toISOString(),
      },
    ],
  };

  // Helper to populate nested relations
  const resolveRelations = (tableName, item) => {
    if (!item) return item;
    const cloned = { ...item };
    if (tableName === "payments") {
      cloned.client = db.profiles.find((p) => p.id === cloned.client_id);
      const lot = db.lots.find((l) => l.id === cloned.lot_id);
      if (lot) {
        cloned.lot = { ...lot };
        cloned.lot.project = db.projects.find((p) => p.id === lot.project_id);
      }
    }
    if (tableName === "lots") {
      cloned.project = db.projects.find((p) => p.id === cloned.project_id);
      cloned.client = db.profiles.find((p) => p.id === cloned.client_id);
    }
    if (tableName === "snag_issues") {
      const lot = db.lots.find((l) => l.id === cloned.lot_id);
      if (lot) {
        cloned.lot = { ...lot };
        cloned.lot.project = db.projects.find((p) => p.id === lot.project_id);
      }
      cloned.creator = db.profiles.find((p) => p.id === cloned.created_by);
    }
    if (tableName === "tasks") {
      cloned.assigned_profile = db.profiles.find(
        (p) => p.id === cloned.assigned_to,
      );
      cloned.created_profile = db.profiles.find(
        (p) => p.id === cloned.created_by,
      );
    }
    if (tableName === "project_engineers") {
      cloned.engineers = db.engineers.find((e) => e.id === cloned.engineer_id);
      cloned.engineer = db.engineers.find((e) => e.id === cloned.engineer_id);
    }
    return cloned;
  };

  // Fluent query builder simulation
  const createQueryBuilder = (tableName) => {
    let currentData = [...(db[tableName] || [])];
    let isSingle = false;

    const builder = {
      select: (fields) => {
        return builder;
      },
      eq: (col, val) => {
        currentData = currentData.filter((item) => item[col] === val);
        return builder;
      },
      neq: (col, val) => {
        currentData = currentData.filter((item) => item[col] !== val);
        return builder;
      },
      in: (col, arr) => {
        currentData = currentData.filter((item) => arr.includes(item[col]));
        return builder;
      },
      single: () => {
        isSingle = true;
        return builder;
      },
      order: (col, { ascending = true } = {}) => {
        currentData.sort((a, b) => {
          if (a[col] < b[col]) return ascending ? -1 : 1;
          if (a[col] > b[col]) return ascending ? 1 : -1;
          return 0;
        });
        return builder;
      },
      insert: (rows) => {
        const rowsToInsert = Array.isArray(rows) ? rows : [rows];
        const newRows = rowsToInsert.map((row) => {
          const inserted = {
            id: row.id || `mock-id-${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString(),
            ...row,
          };
          db[tableName] = db[tableName] || [];
          db[tableName].push(inserted);
          return inserted;
        });
        currentData = newRows;
        return builder;
      },
      update: (fields) => {
        currentData = currentData.map((item) => {
          const matchedInStore = db[tableName].find((i) => i.id === item.id);
          if (matchedInStore) {
            Object.assign(matchedInStore, fields);
            Object.assign(item, fields);
          }
          return item;
        });
        return builder;
      },
      delete: () => {
        currentData.forEach((item) => {
          db[tableName] = db[tableName].filter((i) => i.id !== item.id);
        });
        currentData = [];
        return builder;
      },
      match: (obj) => {
        currentData = currentData.filter((item) => {
          return Object.keys(obj).every((key) => item[key] === obj[key]);
        });
        return builder;
      },
      then: (resolve, reject) => {
        const resolvedData = currentData.map((item) =>
          resolveRelations(tableName, item),
        );
        const finalResult = isSingle ? resolvedData[0] || null : resolvedData;
        resolve({ data: finalResult, error: null });
      },
    };

    return builder;
  };

  const mockClient = {
    auth: {
      signInWithPassword: async ({ email, password }) => {
        const profile = db.profiles.find((p) => p.email === email);
        if (!profile) {
          return { data: {}, error: { message: "Identifiants incorrects." } };
        }
        return {
          data: {
            user: { id: profile.id, email: profile.email },
            session: {
              access_token: `mock-token-${profile.id}`,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        };
      },
      signUp: async ({ email, password, options }) => {
        const existing = db.profiles.find((p) => p.email === email);
        if (existing) {
          return {
            data: {},
            error: { message: "Cet email est déjà inscrit." },
          };
        }
        const meta = options?.data || {};
        const id = `mock-user-${Math.random().toString(36).substr(2, 9)}`;
        const newProfile = {
          id,
          email,
          role: meta.role || "client",
          full_name: meta.full_name || "",
          phone: meta.phone || "",
          created_at: new Date().toISOString(),
        };
        db.profiles.push(newProfile);
        return {
          data: {
            user: { id, email },
          },
          error: null,
        };
      },
      getUser: async (token) => {
        const userId = token.replace("mock-token-", "");
        const profile = db.profiles.find((p) => p.id === userId);
        if (profile) {
          return {
            data: { user: { id: profile.id, email: profile.email } },
            error: null,
          };
        }
        if (token === "mock-admin-token-123456") {
          return {
            data: {
              user: {
                id: "00000000-0000-0000-0000-000000000000",
                email: "admin@admin.com",
              },
            },
            error: null,
          };
        }
        return {
          data: { user: null },
          error: { message: "Session invalide ou expirée." },
        };
      },
    },
    storage: {
      from: (bucketName) => ({
        upload: async (filename, buffer, options) => {
          return { data: { path: filename }, error: null };
        },
        getPublicUrl: (filename) => {
          return {
            data: { publicUrl: `http://192.168.1.5:5000/api/documents/mock` },
          };
        },
      }),
    },
    from: (tableName) => {
      return createQueryBuilder(tableName);
    },
  };

  supabase = mockClient;
  supabaseAdmin = mockClient;
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  supabaseAdmin = supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;
}

module.exports = {
  supabase,
  supabaseAdmin,
};
