"use client";

import { useState } from "react";

type Inquiry = {
  id: string;
  service_id: string;
  vendor_id: string;
  owner_user_id: string;
  requester_name?: string;
  requester_email: string;
  requester_phone?: string;
  message: string;
  status: 'new' | 'replied' | 'closed';
  vendor_note?: string;
  created_at: string;
  updated_at: string;
  services: {
    id: string;
    name?: string;
    title: string;
    slug?: string;
  } | null;
  vendors: {
    id: string;
    business_name: string;
    owner_user_id: string;
  } | null;
};

type Props = {
  initialInquiries: Inquiry[];
};

export default function AdminInquiriesClient({ initialInquiries }: Props) {
  const [inquiries] = useState<Inquiry[]>(initialInquiries);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'replied' | 'closed'>('all');

  const filteredInquiries = inquiries.filter(inquiry => {
    const matchesSearch = !searchTerm || 
      inquiry.requester_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.requester_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.services?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.services?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.vendors?.business_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inquiry.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Inquiry['status']) => {
    const classes = {
      new: "bg-yellow-600 text-yellow-100",
      replied: "bg-blue-600 text-blue-100",
      closed: "bg-gray-600 text-gray-200",
    };

    const labels = {
      new: "New",
      replied: "Replied",
      closed: "Closed",
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${classes[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by email, name, service, or vendor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'new' | 'replied' | 'closed')}
          className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="replied">Replied</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Summary */}
      <div className="text-sm text-muted">
        Showing {filteredInquiries.length} of {inquiries.length} inquiries
      </div>

      {/* Inquiries List */}
      {filteredInquiries.length === 0 ? (
        <div className="card-glass p-8 text-center">
          <p className="text-muted">No inquiries found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInquiries.map((inquiry) => (
            <div key={inquiry.id} className="card-glass p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">
                      {inquiry.services?.name || inquiry.services?.title || 'Unknown Service'}
                    </h3>
                    {getStatusBadge(inquiry.status)}
                  </div>
                  
                  <div className="text-sm text-muted space-y-1 mb-4">
                    <div>
                      <strong>Requester:</strong> {inquiry.requester_name || 'Anonymous'} ({inquiry.requester_email})
                    </div>
                    {inquiry.requester_phone && (
                      <div>
                        <strong>Phone:</strong> {inquiry.requester_phone}
                      </div>
                    )}
                    <div>
                      <strong>Vendor:</strong> {inquiry.vendors?.business_name || 'Unknown'}
                    </div>
                    <div>
                      <strong>Received:</strong> {new Date(inquiry.created_at).toLocaleString()}
                    </div>
                    {inquiry.updated_at !== inquiry.created_at && (
                      <div>
                        <strong>Updated:</strong> {new Date(inquiry.updated_at).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="bg-[var(--surface)] p-4 rounded mb-4">
                    <p className="text-sm whitespace-pre-wrap">{inquiry.message}</p>
                  </div>

                  {inquiry.vendor_note && (
                    <div className="bg-yellow-900/30 border border-yellow-600 p-3 rounded mb-4">
                      <p className="text-xs text-yellow-400">
                        <strong>Vendor Note:</strong> {inquiry.vendor_note}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
