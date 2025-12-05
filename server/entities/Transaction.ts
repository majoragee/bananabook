import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from './Account';
import { RecurringTransaction } from './RecurringTransaction';

export type TransactionType = 'deposit' | 'expense' | 'adjustment';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  description!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount!: number;

  @Column('text')
  type!: TransactionType;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'boolean', default: false })
  reconciled!: boolean;

  @Column({ type: 'date', nullable: true })
  reconciledDate!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Account, (account) => account.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  account!: Account;

  @Column('integer')
  accountId!: number;

  @ManyToOne(() => RecurringTransaction, { nullable: true })
  @JoinColumn()
  recurringTransaction!: RecurringTransaction | null;

  @Column({ type: 'integer', nullable: true })
  recurringTransactionId!: number | null;
}
