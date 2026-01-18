"use client";

import { useState, useEffect } from "react";
import type { Category, CategoryGroup } from "@/lib/categories.types";

type Props = {
  initialCategories: Category[];
};

export default function CategoriesClient({ initialCategories }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [name, setName] = useState("");
  const [group, setGroup] = useState<CategoryGroup>("industrial");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGroup, setEditGroup] = useState<CategoryGroup>("industrial");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, group }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to create category");
        setLoading(false);
        return;
      }

      // Optimistic update
      setCategories([...categories, data.category]);
      setName("");
      setGroup("industrial");
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditGroup(category.group);
  };

  const handleSaveEdit = async (id: string) => {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, group: editGroup }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to update category");
        setLoading(false);
        return;
      }

      // Optimistic update
      setCategories(categories.map((cat) => (cat.id === id ? data.category : cat)));
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditGroup("industrial");
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to delete category");
        setLoading(false);
        return;
      }

      // Optimistic update
      setCategories(categories.filter((cat) => cat.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Create Form */}
      <div className="surface-card p-6">
        <h2 className="text-2xl font-bold mb-4 text-accent">Create Category</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                placeholder="Category name"
              />
            </div>
            <div>
              <label htmlFor="group" className="block text-sm font-medium mb-2">
                Group
              </label>
              <select
                id="group"
                value={group}
                onChange={(e) => setGroup(e.target.value as CategoryGroup)}
                required
                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
              >
                <option value="industrial">Industrial</option>
                <option value="recreational">Recreational</option>
                <option value="convenience">Convenience</option>
                <option value="food">Food</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create Category"}
          </button>
        </form>
      </div>

      {/* Categories Table */}
      <div className="surface-card p-6">
        <h2 className="text-2xl font-bold mb-4 text-accent">Categories</h2>
        {categories.length === 0 ? (
          <p className="text-muted">No categories yet. Create one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Group</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {categories.map((category) => (
                  <tr key={category.id}>
                    {editingId === category.id ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded text-white"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={editGroup}
                            onChange={(e) => setEditGroup(e.target.value as CategoryGroup)}
                            className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded text-white"
                          >
                            <option value="industrial">Industrial</option>
                            <option value="recreational">Recreational</option>
                            <option value="convenience">Convenience</option>
                            <option value="food">Food</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleSaveEdit(category.id)}
                            disabled={loading}
                            className="text-accent hover:text-green-400 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={loading}
                            className="text-muted hover:text-white disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{category.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted capitalize">{category.group}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                          <button
                            onClick={() => handleEdit(category)}
                            disabled={loading}
                            className="text-accent hover:text-green-400 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(category.id, category.name)}
                            disabled={loading}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
