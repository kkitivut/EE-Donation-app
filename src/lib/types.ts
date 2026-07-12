export type Purpose = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type Fd13Code = {
  id: string;
  code: string;
  active: boolean;
};

export type Category = {
  id: string;
  name: string;
  active: boolean;
};

export type Donation = {
  id: string;
  receipt_no: string;
  donor_name: string;
  amount: number;
  receipt_date: string;
  donated_date: string | null;
  purpose_id: string | null;
  fd13_id: string | null;
  channel: string | null;
  account: string | null;
  category_id: string | null;
  drive_url: string | null;
  note: string | null;
};

export type DonationWithRefs = Donation & {
  purposes: Pick<Purpose, "name"> | null;
  fd13_codes: Pick<Fd13Code, "code"> | null;
  categories: Pick<Category, "name"> | null;
};

export type DonationBalance = {
  donation_id: string;
  amount: number;
  allocated: number;
  balance: number;
};

export type DonationListRow = {
  id: string;
  receipt_no: string;
  donor_name: string;
  amount: number;
  receipt_date: string;
  purpose_id: string | null;
  category_id: string | null;
  purpose_name: string | null;
  category_name: string | null;
  balance: number;
};

export type Expense = {
  id: string;
  doc_no: string | null;
  paid_date: string;
  description: string;
  total_amount: number;
  drive_url: string | null;
  note: string | null;
};

export type ExpenseAllocation = {
  id: string;
  expense_id: string;
  donation_id: string;
  amount: number;
};
