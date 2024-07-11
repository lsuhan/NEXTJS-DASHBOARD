'use server';

import { sql } from '@vercel/postgres';
import {z} from 'zod'; // 유형검증 라이브러리
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({invalid_type_error: 'please select a customer'}),
  amount: z.coerce.number().gt(0, {message: 'please enter an amount greater than $0.'}), //숫자로 강제변환. coerce
  status: z.enum(['pending', 'paid'], {invalid_type_error: 'Please select an invoice status'}),
  date: z.string(),
})
const CreateInvoice = FormSchema.omit({id: true, date:true});
export async function createInvoice(prevState: State, formData: FormData) {

  // Validate form using Zod
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
 
  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];
 
  // Insert data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    // If a database error occurs, return a more specific error.
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }
 
  // Revalidate the cache for the invoices page and redirect the user.
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });
export async function updateInvoice(id: string, formData: FormData) {
  const {customerId, amount, status} = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  const amountInCents = amount * 100;

  try {
    await sql`
    UPDATE invoices SET 
      customer_id = ${customerId}, 
      amount = ${amountInCents}, 
      status = ${status}
    WHERE id = ${id}
`;
  } catch(error) {
    return {
      message: `dataBaseError: ${error}`
    }
  }

  revalidatePath('/dashboard/invoices'); //데이터베이스가 업데이트되면 경로 /dashboard/invoices가 다시 검증되고 서버에서 최신 데이터를 가져옵니다.
  redirect('/dashboard/invoices')
}

export async function deleteInvoice(id: string) {
  throw new Error('Failed to Delete Invoice'); //에러 호출 확인;
  try {
    await sql`
    DELETE FROM invoices
    WHERE 1 = 1 
      AND id = ${id}
  `
  revalidatePath('/dashboard/invoices');
  } catch(error) {
    return {
      message: `databaseError: ${error}`
    }
  }

}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}