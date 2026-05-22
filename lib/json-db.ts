export type User = {
  id: string;
  name: string;
  email: string;
  role: "STAFF" | "ADMIN";
  department: string;
  hireDate: string;
  weeklyWorkDays: number;
  weeklyWorkHours: number;
  employmentStatus: "ACTIVE" | "INACTIVE";
  jobTitle?: string;
};

const users: User[] = [
  {
    id: "admin",
    name: "管理者 太郎",
    email: "admin@example.com",
    role: "ADMIN",
    department: "管理部",
    hireDate: "2020-04-01",
    weeklyWorkDays: 5,
    weeklyWorkHours: 40,
    employmentStatus: "ACTIVE",
    jobTitle: "その他"
  },
  {
    id: "hanako",
    name: "佐藤 花子",
    email: "hanako@example.com",
    role: "STAFF",
    department: "訪問看護",
    hireDate: "2022-04-01",
    weeklyWorkDays: 5,
    weeklyWorkHours: 40,
    employmentStatus: "ACTIVE",
    jobTitle: "看護師"
  }
];

export function findUserByEmail(email: string) {
  return users.find((user) => user.email === email) ?? null;
}

export function findUserById(id: string) {
  return users.find((user) => user.id === id) ?? null;
}
