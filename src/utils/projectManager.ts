import { ProjectMetadata, ProjectState } from "./types";

const PROJECTS_KEY = "sync_express_projects";
const PROJECT_STATE_PREFIX = "sync_express_project_state_";

// --- Project Metadata Helper ---

export const getProjects = (): ProjectMetadata[] => {
    try {
        const raw = localStorage.getItem(PROJECTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error("Failed to load projects", e);
        return [];
    }
};

export const saveProjectMetadata = (project: ProjectMetadata) => {
    const projects = getProjects();
    const existingIndex = projects.findIndex((p) => p.id === project.id);

    if (existingIndex >= 0) {
        projects[existingIndex] = project;
    } else {
        projects.push(project);
        // Sort by new first
        projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    }

    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
};

export const createNewProject = (name: string, savePath: string): ProjectMetadata => {
    const newProject: ProjectMetadata = {
        id: crypto.randomUUID(),
        name,
        savePath,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        status: 'active',
    };

    saveProjectMetadata(newProject);
    return newProject;
};

// --- Project State Helper ---

export const getProjectState = (projectId: string): ProjectState | null => {
    try {
        const raw = localStorage.getItem(`${PROJECT_STATE_PREFIX}${projectId}`);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error(`Failed to load state for project ${projectId}`, e);
        return null;
    }
};

export const saveProjectState = (projectId: string, state: Partial<ProjectState>) => {
    const currentState = getProjectState(projectId) || {
        projectId,
        step: 0,
        videos: [],
        transcriptText: null,
        transcriptFileName: null,
        transcriptPath: null,
        startLine: "0",
        syncedLines: [],
        mappedResult: null,
        editedSubtitles: [],
        splitPoints: [],
        isProcessing: false,
        hasAutoExported: false
    };

    const newState = { ...currentState, ...state };
    localStorage.setItem(`${PROJECT_STATE_PREFIX}${projectId}`, JSON.stringify(newState));

    // Update last modified on metadata
    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    if (project) {
        project.lastModified = new Date().toISOString();
        saveProjectMetadata(project);
    }
};

export const deleteProject = (projectId: string) => {
    // Remove from metadata
    let projects = getProjects();
    projects = projects.filter(p => p.id !== projectId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

    // Remove state
    localStorage.removeItem(`${PROJECT_STATE_PREFIX}${projectId}`);
}
