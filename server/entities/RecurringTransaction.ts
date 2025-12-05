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

export type FrequencyType = 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly';
export type TransactionType = 'deposit' | 'expense';

@Entity()
export class RecurringTransaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  description!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount!: number;

  @Column('text')
  type!: TransactionType;

  @Column('text')
  frequency!: FrequencyType;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Account, (account) => account.recurringTransactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  account!: Account;

  @Column('integer')
  accountId!: number;
}
