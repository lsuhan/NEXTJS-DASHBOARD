'use server';

import { sql } from '@vercel/postgres';
import {z} from 'zod'; // 유형검증 라이브러리
import { revalidatePath } from 'next/cache';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(), //숫자로 강제변환. coerce
  status: z.enum(['pending', 'paid']),
  date: z.string(),
})
const CreateInvoice = FormSchema.omit({id: true, date:true});
export async function createInvoice(formData: FormData) {
  //const rawFormData = Object.fromEntries(formData.entries()); //데이터가 많을때

  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
  revalidatePath('/dashboard/invoices'); //데이터베이스가 업데이트되면 경로 /dashboard/invoices가 다시 검증되고 서버에서 최신 데이터를 가져옵니다.
}