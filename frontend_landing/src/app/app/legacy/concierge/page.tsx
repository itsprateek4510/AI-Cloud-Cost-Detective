"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/components/ecosystem/provider";
import { request } from "@/lib/api";
import { BookOpen, ShieldCheck, Calendar, Clipboard, Check } from "lucide-react";

type WorkspaceJson = Record<string, unknown> | null;

interface ConciergeGrant {
  id: string;
  grantor_user_id: string;
  grantee_user_id: string;
  family_id: string;
  grant_type: string;
  scope_type: string;
  scope_id: string;
  permission_level: string;
  revoked_at: string | null;
  expires_at: string | null;
  purpose: string;
  created_at: string;
}

interface ConciergeProject {
  id: string;
  family_id: string;
  owner_user_id: string;
  concierge_coordinator_id: string | null;
  title: string;
  description: string | null;
  status: string;
  checklist: WorkspaceJson;
  milestones: WorkspaceJson;
  deliverables: WorkspaceJson;
  family_review_requested: boolean;
  family_review_status: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function ConciergeWorkspace() {
  const { families, space } = useApp();
  const initialFamily = families.find((f) => f.id === space?.family_id) ?? families[0];
  const [chosenFamily, setChosenFamily] = useState(initialFamily?.id ?? "");
  const family = families.find((f) => f.id === chosenFamily) ?? initialFamily;

  const grants = useQuery({
    queryKey: ["concierge-grants", chosenFamily],
    queryFn: () =>
      request<ConciergeGrant[]>(`/v1/families/${chosenFamily}/concierge/grants`),
    enabled: !!chosenFamily,
  });

  const projects = useQuery({
    queryKey: ["concierge-projects", chosenFamily],
    queryFn: () =>
      request<ConciergeProject[]>(`/v1/families/${chosenFamily}/concierge/projects`),
    enabled: !!chosenFamily,
  });

  const grantClient = useQueryClient();

  const revokeGrant = (grantId: string) => {
    void request(`/v1/families/${chosenFamily}/concierge/grants/${grantId}`, {
      method: "DELETE",
    })
      .then(() => grantClient.invalidateQueries({ queryKey: ["concierge-grants", chosenFamily] }))
      .catch(() => grantClient.invalidateQueries({ queryKey: ["concierge-grants", chosenFamily] }));
  };

  if (!family) {
    return (
      <div className="legacy">
        <header className="legacy-head">
          <div>
            <span className="legacy-eyebrow">Smriti Legacy</span>
            <h1>Concierge Workspace</h1>
            <p className="legacy-sub">
              Select a family to view concierge projects and grants.
            </p>
          </div>
        </header>
        <section className="legacy-hero" style={{ marginTop: 26 }}>
          <span className="legacy-hero-mark">Select</span>
          <h2>No family yet</h2>
          <p>
            Create a family to open the concierge workspace. Your personal chat and
            memories stay exactly as they are.
          </p>
          <p style={{ marginTop: 18 }}>
            <Link
              href="/onboarding"
              style={{
                color: "#cdb079",
                borderBottom: "1px solid rgba(205,176,121,0.6)",
              }}
            >
              Create a family →
            </Link>
          </p>
        </section>
      </div>
    );
  }

  const loading = grants.isLoading || projects.isLoading;
  const failed = grants.isError || projects.isError;

  if (loading) {
    return (
      <div className="legacy">
        <p className="legacy-loading" aria-busy="true">
          Loading concierge workspace…
        </p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="legacy">
        <p className="legacy-error" role="alert">
          {(grants.error as Error)?.message ?? (projects.error as Error)?.message ?? "Could not open concierge workspace."}
        </p>
      </div>
    );
  }

  const familyGrants = grants.data ?? [];
  const familyProjects = projects.data ?? [];

  return (
    <div className="legacy">
      <header className="legacy-head">
        <div>
          <span className="legacy-eyebrow">Smriti Legacy</span>
          <h1>Concierge Workspace</h1>
          <p className="legacy-sub">
            White-glove family project coordination with explicit, revocable access grants.
          </p>
        </div>
        {families.length > 1 && (
          <div className="legacy-family-picker">
            <label htmlFor="legacy-family">Family</label>
            <select
              id="legacy-family"
              aria-label="Family"
              value={chosenFamily}
              onChange={(e) => setChosenFamily(e.target.value)}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <section className="legacy-hero" aria-labelledby="workspace-overview">
        <span className="legacy-hero-mark">Family Project Overview</span>
        <h2 id="workspace-overview">{family.name}</h2>
        <p>
          Private project coordination with audience‑safe memory access. All grants are
          explicit, limited in scope, and revocable. Project‑management metadata is
          separate from the private archive.
        </p>
      </section>

      <div className="legacy-grid">
        {/* Grants Section */}
        <section className="legacy-card">
          <Clipboard size={18} /> Grants
          <h3>Explicit Access Grants</h3>
          <p className="legacy-note">
            Concierge grants are explicit, limited‑scope, and revocable. The concierge
            does NOT automatically inherit all family memory access.
          </p>
          {familyGrants.length === 0 ? (
            <div className="legacy-empty">
              <ShieldCheck size={22} /> No grants yet
              <p>Family owners and editors can grant explicit content access.</p>
            </div>
          ) : (
            <ul className="legacy-list">
              {familyGrants.map((grant) => (
                <li key={grant.id} className="legacy-grant-item">
                  <div className="legacy-grant-info">
                    <strong>{grant.scope_type}: {grant.scope_id ? "selected item" : "all"}</strong>
                    <span className={`legacy-badge ${grant.permission_level}`}> {grant.permission_level}</span>
                  </div>
                  <div className="legacy-grant-meta">
                    <span>Granted by: {grant.grantor_user_id}</span>
                    <span>To: {grant.grantee_user_id}</span>
                    {grant.expires_at && <span>Expires: {new Date(grant.expires_at).toLocaleDateString()}</span>}
                    {grant.revoked_at && (
                      <span>Revoked: {new Date(grant.revoked_at).toLocaleDateString()}</span>
                    )}
                    {!grant.revoked_at && (
                      <button className="legacy-button--secondary" onClick={() => revokeGrant(grant.id)}>
                        Revoke
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="legacy-note" style={{ marginTop: 12 }}>
            <Link href="/app/legacy/concierge/grants/new">Grant new access →</Link>
          </p>
        </section>

        {/* Projects Section */}
        <section className="legacy-card">
          <Clipboard size={18} /> Projects
          <h3>Heritage Collection Projects</h3>
          <p className="legacy-note">
            Project‑management metadata is separate from private archive content.
            Checklists, milestones, and deliverables are tracked here.
          </p>
          {familyProjects.length === 0 ? (
            <div className="legacy-empty">
              <BookOpen size={22} /> No projects yet
              <p>Family owners and editors can create concierge projects.</p>
            </div>
          ) : (
            <ul className="legacy-list">
              {familyProjects.map((project) => (
                <li key={project.id} className="legacy-project-item">
                  <div className="legacy-project-head">
                    <BookOpen size={18} /> {project.title}
                    {project.status === "completed" && <Check size={12} />}
                  </div>
                  <div className="legacy-project-meta">
                    <span>Owner: {project.owner_user_id}</span>
                    <span>Coordinator: {project.concierge_coordinator_id || "—"}</span>
                    <span>Status: {project.status}</span>
                    {project.family_review_requested && (
                      <span>Family review: {project.family_review_status}</span>
                    )}
                  </div>
                  <div className="legacy-project-actions">
                    <Link href={`/app/legacy/concierge/projects/${project.id}`} className="legacy-button--secondary">
                      View details
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="legacy-note" style={{ marginTop: 12 }}>
            <Link href="/app/legacy/concierge/projects/new">Create new project →</Link>
          </p>
        </section>

        {/* Family Review Section */}
        {familyProjects.some((p) => p.family_review_requested) && (
          <section className="legacy-card legacy-card--wide">
            <Calendar size={18} /> Family Review
            <h3>Family Review Requests</h3>
            <p className="legacy-note">
              Pending family reviews for project deliverables.
            </p>
            <ul className="legacy-list">
              {familyProjects
                .filter((p) => p.family_review_requested && p.family_review_status === "pending")
                .map((project) => (
                  <li key={project.id}>
                    <strong>{project.title}</strong>
                    <span>Review status: {project.family_review_status}</span>
                    <button className="legacy-button legacy-button--secondary">
                      Approve/Reject
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {/* Access Guide */}
        <section className="legacy-card legacy-card--wide">
          <ShieldCheck size={18} /> Access Guide
          <h3>Key Principles</h3>
          <ul className="legacy-list">
            <li>
              <strong>No automatic memory access.</strong> Concierge grants are explicit
              and limited to specific scopes only.
            </li>
            <li>
              <strong>Revocable at any time.</strong> Owners and editors can revoke
              grants whenever needed.
            </li>
            <li>
              <strong>Metadata separate from archive.</strong> Project checklists,
              milestones, and deliverables are tracked independently of private
              memories and recordings.
            </li>
            <li>
              <strong>Role‑based security.</strong> Family Owner, Authorized Family
              Editor, Family Member, and Concierge Coordinator each have distinct
              access levels.
            </li>
            <li>
              <strong>Sensitive actions logged.</strong> All grant creation, revocation,
              and project changes are audited.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}