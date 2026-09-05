export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_transfers: {
        Row: {
          amount_in: number
          amount_out: number
          created_at: string | null
          created_by: string | null
          from_account_id: string
          id: string
          notes: string | null
          reference: string | null
          to_account_id: string
          transferred_on: string
        }
        Insert: {
          amount_in: number
          amount_out: number
          created_at?: string | null
          created_by?: string | null
          from_account_id: string
          id?: string
          notes?: string | null
          reference?: string | null
          to_account_id: string
          transferred_on?: string
        }
        Update: {
          amount_in?: number
          amount_out?: number
          created_at?: string | null
          created_by?: string | null
          from_account_id?: string
          id?: string
          notes?: string | null
          reference?: string | null
          to_account_id?: string
          transferred_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          bank_name: string | null
          created_at: string | null
          created_by: string | null
          currency: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          opening_date: string
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          account_type: string
          bank_name?: string | null
          created_at?: string | null
          created_by?: string | null
          currency: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          opening_date?: string
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          opening_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      counters: {
        Row: {
          current_value: number
          key: string
        }
        Insert: {
          current_value: number
          key: string
        }
        Update: {
          current_value?: number
          key?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          company: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          nationality: string | null
          notes: string | null
          passport_number: string | null
          phone: string
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          nationality?: string | null
          notes?: string | null
          passport_number?: string | null
          phone: string
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          nationality?: string | null
          notes?: string | null
          passport_number?: string | null
          phone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string
          deal_ref: string
          deal_value: number
          description: string | null
          end_date: string | null
          id: string
          notes: string | null
          party_id: string
          pax_count: number | null
          payment_due_on: string | null
          start_date: string | null
          status: string
          title: string
          travel_group_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          deal_ref?: string
          deal_value?: number
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          party_id: string
          pax_count?: number | null
          payment_due_on?: string | null
          start_date?: string | null
          status?: string
          title: string
          travel_group_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          deal_ref?: string
          deal_value?: number
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          party_id?: string
          pax_count?: number | null
          payment_due_on?: string | null
          start_date?: string | null
          status?: string
          title?: string
          travel_group_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_travel_group_id_fkey"
            columns: ["travel_group_id"]
            isOneToOne: false
            referencedRelation: "travel_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
        ]
      }
      expenses: {
        Row: {
          amount: number
          bank_account_id: string | null
          category_id: string
          created_at: string | null
          created_by: string | null
          currency: string
          deal_id: string | null
          description: string
          due_on: string | null
          expense_ref: string
          id: string
          method: string | null
          notes: string | null
          paid_on: string | null
          party_id: string | null
          reference: string | null
          spent_on: string
          status: string
          travel_group_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category_id: string
          created_at?: string | null
          created_by?: string | null
          currency: string
          deal_id?: string | null
          description: string
          due_on?: string | null
          expense_ref?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string | null
          party_id?: string | null
          reference?: string | null
          spent_on?: string
          status?: string
          travel_group_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category_id?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          description?: string
          due_on?: string | null
          expense_ref?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string | null
          party_id?: string | null
          reference?: string | null
          spent_on?: string
          status?: string
          travel_group_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_travel_group_id_fkey"
            columns: ["travel_group_id"]
            isOneToOne: false
            referencedRelation: "travel_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          description: string | null
          id: string
          invoice_id: string | null
          position: number
          quantity: number
          rate: number
          reference: string | null
          title: string
        }
        Insert: {
          amount: number
          description?: string | null
          id?: string
          invoice_id?: string | null
          position: number
          quantity?: number
          rate: number
          reference?: string | null
          title: string
        }
        Update: {
          amount?: number
          description?: string | null
          id?: string
          invoice_id?: string | null
          position?: number
          quantity?: number
          rate?: number
          reference?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_in_words: string
          bill_to_address: string | null
          bill_to_email: string | null
          bill_to_name: string
          bill_to_phone: string | null
          created_at: string | null
          created_by: string | null
          currency: string
          customer_id: string | null
          deal_id: string | null
          due_date_label: string | null
          id: string
          invoice_number: string
          issue_date: string
          lead_id: string | null
          pdf_path: string | null
          sequence_number: number
          status: string
          subtotal: number
          tax: number
          terms: string | null
          total: number
          updated_at: string | null
          visa_reference: string | null
        }
        Insert: {
          amount_in_words: string
          bill_to_address?: string | null
          bill_to_email?: string | null
          bill_to_name: string
          bill_to_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deal_id?: string | null
          due_date_label?: string | null
          id?: string
          invoice_number: string
          issue_date: string
          lead_id?: string | null
          pdf_path?: string | null
          sequence_number: number
          status?: string
          subtotal?: number
          tax?: number
          terms?: string | null
          total?: number
          updated_at?: string | null
          visa_reference?: string | null
        }
        Update: {
          amount_in_words?: string
          bill_to_address?: string | null
          bill_to_email?: string | null
          bill_to_name?: string
          bill_to_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deal_id?: string | null
          due_date_label?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          lead_id?: string | null
          pdf_path?: string | null
          sequence_number?: number
          status?: string
          subtotal?: number
          tax?: number
          terms?: string | null
          total?: number
          updated_at?: string | null
          visa_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          body: string | null
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string | null
          new_status: string | null
          old_status: string | null
        }
        Insert: {
          activity_type: string
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string | null
          new_status?: string | null
          old_status?: string | null
        }
        Update: {
          activity_type?: string
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string | null
          new_status?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          canton_phase: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          email: string | null
          enquiry_type: string
          entry_city: string | null
          full_name: string
          id: string
          lead_ref: string
          lost_reason: string | null
          next_followup_date: string | null
          notes: string | null
          package_tier: string | null
          pax_count: number | null
          phone: string
          quoted_amount: number | null
          quoted_currency: string | null
          source: string
          status: string
          travel_month: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          canton_phase?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          email?: string | null
          enquiry_type: string
          entry_city?: string | null
          full_name: string
          id?: string
          lead_ref: string
          lost_reason?: string | null
          next_followup_date?: string | null
          notes?: string | null
          package_tier?: string | null
          pax_count?: number | null
          phone: string
          quoted_amount?: number | null
          quoted_currency?: string | null
          source: string
          status?: string
          travel_month?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          canton_phase?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          email?: string | null
          enquiry_type?: string
          entry_city?: string | null
          full_name?: string
          id?: string
          lead_ref?: string
          lost_reason?: string | null
          next_followup_date?: string | null
          notes?: string | null
          package_tier?: string | null
          pax_count?: number | null
          phone?: string
          quoted_amount?: number | null
          quoted_currency?: string | null
          source?: string
          status?: string
          travel_month?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          address: string | null
          contact_name: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          default_currency: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          party_type: string
          payment_terms: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          default_currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          party_type: string
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          default_currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          party_type?: string
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          role: string
          username: string
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id: string
          role?: string
          username: string
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          role?: string
          username?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number
          applied_amount: number | null
          bank_account_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string
          deal_id: string | null
          id: string
          invoice_id: string | null
          method: string
          notes: string | null
          party_id: string | null
          payer_name: string | null
          receipt_ref: string
          received_on: string
          reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          applied_amount?: number | null
          bank_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency: string
          deal_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          party_id?: string | null
          payer_name?: string | null
          receipt_ref?: string
          received_on?: string
          reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          applied_amount?: number | null
          bank_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          party_id?: string | null
          payer_name?: string | null
          receipt_ref?: string
          received_on?: string
          reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_groups: {
        Row: {
          created_at: string | null
          created_by: string | null
          group_code: string
          guide_name: string | null
          id: string
          label: string | null
          notes: string | null
          reference_prefix: string
          travel_date: string
          travel_end_date: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          group_code: string
          guide_name?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          reference_prefix?: string
          travel_date: string
          travel_end_date: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          group_code?: string
          guide_name?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          reference_prefix?: string
          travel_date?: string
          travel_end_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_packs: {
        Row: {
          generated_at: string | null
          generated_by: string | null
          id: string
          included_doc_ids: string[] | null
          page_count: number | null
          storage_path: string
          traveller_id: string | null
        }
        Insert: {
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          included_doc_ids?: string[] | null
          page_count?: number | null
          storage_path: string
          traveller_id?: string | null
        }
        Update: {
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          included_doc_ids?: string[] | null
          page_count?: number | null
          storage_path?: string
          traveller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_packs_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_packs_traveller_id_fkey"
            columns: ["traveller_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id"]
          },
        ]
      }
      traveller_documents: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          doc_type: string
          file_name: string
          file_size: number | null
          id: string
          merge_order: number
          mime_type: string
          storage_path: string
          traveller_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          doc_type: string
          file_name: string
          file_size?: number | null
          id?: string
          merge_order?: number
          mime_type: string
          storage_path: string
          traveller_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          doc_type?: string
          file_name?: string
          file_size?: number | null
          id?: string
          merge_order?: number
          mime_type?: string
          storage_path?: string
          traveller_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traveller_documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traveller_documents_traveller_id_fkey"
            columns: ["traveller_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traveller_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      travellers: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          email: string | null
          full_name: string
          id: string
          invoice_id: string | null
          lead_id: string | null
          nationality: string | null
          notes: string | null
          package_tier: string | null
          passport_number: string | null
          phone: string | null
          status: string
          travel_end_date: string
          travel_group_id: string | null
          travel_start_date: string
          traveller_ref: string
          updated_at: string | null
          visa_reference: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          invoice_id?: string | null
          lead_id?: string | null
          nationality?: string | null
          notes?: string | null
          package_tier?: string | null
          passport_number?: string | null
          phone?: string | null
          status?: string
          travel_end_date: string
          travel_group_id?: string | null
          travel_start_date: string
          traveller_ref: string
          updated_at?: string | null
          visa_reference?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          invoice_id?: string | null
          lead_id?: string | null
          nationality?: string | null
          notes?: string | null
          package_tier?: string | null
          passport_number?: string | null
          phone?: string | null
          status?: string
          travel_end_date?: string
          travel_group_id?: string | null
          travel_start_date?: string
          traveller_ref?: string
          updated_at?: string | null
          visa_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travellers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travellers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travellers_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travellers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travellers_travel_group_id_fkey"
            columns: ["travel_group_id"]
            isOneToOne: false
            referencedRelation: "travel_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bank_account_balances: {
        Row: {
          balance: number | null
          bank_account_id: string | null
        }
        Relationships: []
      }
      deal_balances: {
        Row: {
          costs: number | null
          costs_other_currency: number | null
          deal_id: string | null
          invoiced: number | null
          received: number | null
        }
        Relationships: []
      }
      invoice_balances: {
        Row: {
          balance: number | null
          invoice_id: string | null
          last_received_on: string | null
          receipt_count: number | null
          received: number | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_invoice: {
        Args: { p_year: number; p_invoice: Json; p_items: Json }
        Returns: string
      }
      create_lead: { Args: { p_year: number; p_lead: Json }; Returns: string }
      create_traveller: {
        Args: { p_year: number; p_traveller: Json }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      next_counter: { Args: { counter_key: string }; Returns: number }
      update_invoice: {
        Args: { p_id: string; p_invoice: Json; p_items: Json }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
