import React, { useState, useRef } from "react";
import {
  FaUserCircle,
  FaFolder,
  FaFileAlt,
  FaPlus,
  FaChevronLeft,
  FaTrash,
  FaEdit,
  FaCheck,
  FaTimes
} from "react-icons/fa";

// Helpers
function createFolder(name) {
  return {
    id: Date.now() + Math.random(),
    name,
    type: "folder",
    children: [],
  };
}
function createFile({ name, url = "", fileObj = null }) {
  return {
    id: Date.now() + Math.random(),
    name,
    type: "file",
    url,
    fileObj,
    fileType: fileObj ? fileObj.type : "",
  };
}
// Update node and return updated node reference
function updateNodeByIdAndReturn(nodes, id, updater) {
  let updatedNode = null;
  const newNodes = nodes.map(node => {
    if (node.id === id) {
      const updated = updater(node);
      updatedNode = updated;
      return updated;
    }
    if (node.type === "folder") {
      const { nodes: updatedChildren, updatedNode: childUpdated } = updateNodeByIdAndReturn(node.children, id, updater);
      if (childUpdated) updatedNode = childUpdated;
      return { ...node, children: updatedChildren };
    }
    return node;
  });
  return { nodes: newNodes, updatedNode };
}
// Delete node by id recursively
function deleteNodeById(nodes, id) {
  return nodes
    .filter(node => node.id !== id)
    .map(node =>
      node.type === "folder"
        ? { ...node, children: deleteNodeById(node.children, id) }
        : node
    );
}
// Find node by id recursively
function findNodeById(nodes, id) {
  for (let node of nodes) {
    if (node.id === id) return node;
    if (node.type === "folder") {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Main component
export default function Resources() {
  const [tree, setTree] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null); // use id instead of object
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  // Modal and input states
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddSubfolder, setShowAddSubfolder] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [newFileURL, setNewFileURL] = useState("");
  const fileInputRef = useRef();
  // Rename
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  // Always get selectedFolder from tree by id for up-to-date data
  const selectedFolder = selectedFolderId ? findNodeById(tree, selectedFolderId) : null;

  // Add folder to root
  function handleAddFolder() {
    if (!newFolderName.trim()) return;
    setTree([...tree, createFolder(newFolderName.trim())]);
    setNewFolderName("");
    setShowAddFolder(false);
  }
  // Add subfolder to selected folder
  function handleAddSubfolder() {
    if (!newSubfolderName.trim() || !selectedFolder) return;
    setTree(tree => {
      const { nodes } = updateNodeByIdAndReturn(tree, selectedFolder.id, folder => ({
        ...folder,
        children: [...folder.children, createFolder(newSubfolderName.trim())],
      }));
      return nodes;
    });
    setNewSubfolderName("");
    setShowAddSubfolder(false);
  }
  // Add file to selected folder (uploaded file or link)
  function handleAddFile(e) {
    e && e.preventDefault();
    if (!newFileName.trim() && !newFileURL && !fileInputRef.current?.files[0]) return;

    let fileObj = fileInputRef.current?.files[0] || null;
    let url = newFileURL.trim();
    let name = newFileName.trim();
    let fileData = null;
    if (fileObj) {
      url = URL.createObjectURL(fileObj);
      name = name || fileObj.name;
      fileData = { name, url, fileObj };
    } else if (url) {
      fileData = { name: name || url, url, fileObj: null };
    }
    if (!fileData) return;

    if (selectedFolder) {
      setTree(tree => {
        const { nodes } = updateNodeByIdAndReturn(tree, selectedFolder.id, folder => ({
          ...folder,
          children: [...folder.children, createFile(fileData)],
        }));
        return nodes;
      });
    } else {
      setTree([...tree, createFile(fileData)]);
    }
    setNewFileName("");
    setNewFileURL("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowAddFile(false);
  }

  // Delete node (file/folder/subfolder)
  function handleDeleteNode(id) {
    setTree(tree => deleteNodeById(tree, id));
    // If deleting current folder, go back
    if (selectedFolder && selectedFolder.id === id) {
      handleBack();
    }
    setDeleteConfirmId(null);
  }
  // Rename
  function handleStartRename(node) {
    setRenamingId(node.id);
    setRenameValue(node.name);
  }
  function handleRenameSubmit(node) {
    if (!renameValue.trim()) return;
    setTree(tree =>
      updateNodeByIdAndReturn(tree, node.id, n => ({ ...n, name: renameValue.trim() })).nodes
    );
    setRenamingId(null);
    setRenameValue("");
    // If renaming the current folder, update breadcrumbs and selection
    if (selectedFolder && node.id === selectedFolder.id) {
      setBreadcrumbs(breadcrumbs =>
        breadcrumbs.map(b => b.id === node.id ? { ...b, name: renameValue.trim() } : b)
      );
    }
  }
  function handleRenameCancel() {
    setRenamingId(null);
    setRenameValue("");
  }

  // Navigation
  function handleOpenFolder(folder) {
    setSelectedFolderId(folder.id);
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
  }
  function handleBack() {
    const newBreadcrumbs = [...breadcrumbs];
    newBreadcrumbs.pop();
    const parent = newBreadcrumbs.length > 0 ? newBreadcrumbs[newBreadcrumbs.length - 1] : null;
    setSelectedFolderId(parent ? parent.id : null);
    setBreadcrumbs(newBreadcrumbs);
  }

  // UI: Actions
  function renderFolderActions() {
    return (
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <button style={actionBtnStyle} onClick={() => setShowAddSubfolder(true)}>
          <FaPlus style={{ marginRight: 6 }} />
          Add Subfolder
        </button>
        <button style={actionBtnStyle} onClick={() => setShowAddFile(true)}>
          <FaPlus style={{ marginRight: 6 }} />
          Add File
        </button>
      </div>
    );
  }
  function renderRootActions() {
    return (
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <button style={actionBtnStyle} onClick={() => setShowAddFolder(true)}>
          <FaPlus style={{ marginRight: 6 }} />
          Add Folder
        </button>
        <button style={actionBtnStyle} onClick={() => setShowAddFile(true)}>
          <FaPlus style={{ marginRight: 6 }} />
          Add File
        </button>
      </div>
    );
  }

  // UI: File/folder cards
  function renderNodes(nodes) {
    if (!nodes || nodes.length === 0) {
      return <div style={{ color: "#aaa", fontSize: 18, marginTop: 20 }}>No folders or files yet.</div>;
    }
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
        {nodes.map(node => {
          const isRenaming = renamingId === node.id;
          if (node.type === "folder") {
            return (
              <div key={node.id} style={folderCardStyle}>
                <div
                  style={{ cursor: isRenaming ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center" }}
                  onClick={() => !isRenaming && handleOpenFolder(node)}
                >
                  <FaFolder size={45} color="#FFD600" style={{ marginBottom: 10 }} />
                  {isRenaming ? (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <input
                        value={renameValue}
                        autoFocus
                        style={renameInputStyle}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleRenameSubmit(node);
                          if (e.key === "Escape") handleRenameCancel();
                        }}
                      />
                      <button style={renameIconBtn} onClick={() => handleRenameSubmit(node)} title="Save">
                        <FaCheck />
                      </button>
                      <button style={renameIconBtn} onClick={handleRenameCancel} title="Cancel">
                        <FaTimes />
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: 22, color: "#fff", display: "flex", alignItems: "center" }}>
                      {node.name}
                      <button style={renameBtnStyle} onClick={e => {e.stopPropagation(); handleStartRename(node);}} title="Rename">
                        <FaEdit />
                      </button>
                    </div>
                  )}
                </div>
                <button
                  style={deleteBtnStyle}
                  onClick={e => { e.stopPropagation(); setDeleteConfirmId(node.id); }}
                  title="Delete Folder"
                >
                  <FaTrash />
                </button>
                {deleteConfirmId === node.id && (
                  <div style={confirmModalStyle}>
                    <div style={confirmBoxStyle}>
                      <div style={{ marginBottom: 12, color: "#232b36", fontWeight: 700, fontSize: 17 }}>
                        r u sure u wanna delete it?
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button style={modalBtnStyle} onClick={() => handleDeleteNode(node.id)}>
                          Yes, delete
                        </button>
                        <button style={modalBtnAltStyle} onClick={() => setDeleteConfirmId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }
          // file
          return (
            <div key={node.id} style={fileCardStyle}>
              <FaFileAlt size={38} color="#FFD600" style={{ marginBottom: 8 }} />
              {isRenaming ? (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    value={renameValue}
                    autoFocus
                    style={renameInputStyle}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleRenameSubmit(node);
                      if (e.key === "Escape") handleRenameCancel();
                    }}
                  />
                  <button style={renameIconBtn} onClick={() => handleRenameSubmit(node)} title="Save">
                    <FaCheck />
                  </button>
                  <button style={renameIconBtn} onClick={handleRenameCancel} title="Cancel">
                    <FaTimes />
                  </button>
                </div>
              ) : (
                <div style={{ fontWeight: 600, fontSize: 17, color: "#fff", wordBreak: "break-all", display: "flex", alignItems: "center" }}>
                  {node.name}
                  <button style={renameBtnStyle} onClick={() => handleStartRename(node)} title="Rename">
                    <FaEdit />
                  </button>
                </div>
              )}
              {node.fileObj ? (
                <a
                  href={node.url}
                  download={node.name}
                  style={{
                    color: "#FFD600",
                    fontWeight: 700,
                    fontSize: 15,
                    marginTop: 3,
                  }}
                >
                  [Download]
                </a>
              ) : (
                node.url && (
                  <a
                    href={node.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#FFD600",
                      fontWeight: 700,
                      fontSize: 15,
                      marginTop: 3,
                    }}
                  >
                    [Open]
                  </a>
                )
              )}
              <button
                style={deleteBtnStyle}
                onClick={() => setDeleteConfirmId(node.id)}
                title="Delete File"
              >
                <FaTrash />
              </button>
              {deleteConfirmId === node.id && (
                <div style={confirmModalStyle}>
                  <div style={confirmBoxStyle}>
                    <div style={{ marginBottom: 12, color: "#232b36", fontWeight: 700, fontSize: 17 }}>
                      r u sure u wanna delete it?
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button style={modalBtnStyle} onClick={() => handleDeleteNode(node.id)}>
                        Yes, delete
                      </button>
                      <button style={modalBtnAltStyle} onClick={() => setDeleteConfirmId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Add File Modal (kept mounted for smooth typing)
  const AddFileModal = (
    showAddFile && <div style={modalStyle}>
      <form style={modalBoxStyle} onSubmit={handleAddFile}>
        <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 16 }}>Add File</div>
        <input
          type="text"
          placeholder="File name (optional)"
          value={newFileName}
          onChange={e => setNewFileName(e.target.value)}
          style={inputStyle}
        />
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
          style={inputStyle}
          onClick={e => { e.target.value = null; }} // allow same file re-select
        />
        <div style={{ color: "#FFD600", fontWeight: 400, fontSize: 15, marginBottom: 6 }}>or</div>
        <input
          type="url"
          placeholder="Paste a link (Google Docs, YouTube, etc)"
          value={newFileURL}
          onChange={e => setNewFileURL(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 14, marginTop: 18 }}>
          <button
            style={modalBtnStyle}
            type="submit"
          >Upload</button>
          <button style={modalBtnAltStyle} type="button" onClick={() => {
            setShowAddFile(false);
            setNewFileName(""); setNewFileURL("");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}>Cancel</button>
        </div>
      </form>
    </div>
  );

  // UI
  return (
    <div style={{
      flex: 1,
      background: "#111722",
      minHeight: "100vh",
      padding: 0,
      position: "relative"
    }}>
      {/* Header */}
      <div style={{
        width: '100%',
        maxWidth: 1100,
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 54
      }}>
        <h1 style={{
          fontWeight: 700,
          fontSize: 60,
          letterSpacing: 1,
          margin: 0,
          color: "#fff"
        }}>
          Resources
        </h1>
        <FaUserCircle size={58} color="#FFD600" />
      </div>

      {/* Breadcrumbs/nav */}
      {breadcrumbs.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", marginLeft: 72, marginTop: 16, marginBottom: 8
        }}>
          <button
            onClick={handleBack}
            style={{
              background: "none",
              border: "none",
              color: "#FFD600",
              fontSize: 22,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              marginRight: 12,
            }}
          >
            <FaChevronLeft style={{ marginRight: 4 }} />
            Back
          </button>
          <span style={{
            color: "#FFD600",
            fontWeight: 600,
            fontSize: 20
          }}>
            {breadcrumbs.map((b, i) => (
              <span key={b.id}>
                {b.name}
                {i < breadcrumbs.length - 1 && <span style={{ color: "#fff" }}> / </span>}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{
        width: "100%",
        maxWidth: 1050,
        margin: "0 auto",
        marginTop: 30,
        marginBottom: 30,
        paddingLeft: 8
      }}>
        {selectedFolder ? renderFolderActions() : renderRootActions()}
        {/* Modals */}
        {showAddFolder && (
          <div style={modalStyle}>
            <div style={modalBoxStyle}>
              <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 16 }}>Add Folder</div>
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: "flex", gap: 14, marginTop: 18 }}>
                <button style={modalBtnStyle} onClick={handleAddFolder}>Create</button>
                <button style={modalBtnAltStyle} onClick={() => { setShowAddFolder(false); setNewFolderName(""); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {showAddSubfolder && (
          <div style={modalStyle}>
            <div style={modalBoxStyle}>
              <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 16 }}>Add Subfolder</div>
              <input
                type="text"
                placeholder="Subfolder name"
                value={newSubfolderName}
                onChange={e => setNewSubfolderName(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: "flex", gap: 14, marginTop: 18 }}>
                <button style={modalBtnStyle} onClick={handleAddSubfolder}>Create</button>
                <button style={modalBtnAltStyle} onClick={() => { setShowAddSubfolder(false); setNewSubfolderName(""); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {AddFileModal}
        {/* Folder/File Tree */}
        <div style={{ marginTop: 10 }}>
          {selectedFolder
            ? renderNodes(selectedFolder.children)
            : renderNodes(tree)}
        </div>
      </div>
    </div>
  );
}

// --- Styles ---
const actionBtnStyle = {
  background: "#FFD600",
  color: "#181d24",
  fontWeight: 700,
  padding: "10px 22px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  fontSize: 17,
  display: "flex",
  alignItems: "center",
  boxShadow: "0 1px 6px #0002",
  marginTop: 2,
};
const folderCardStyle = {
  background: "#19202A",
  borderRadius: 22,
  border: "2.2px solid #232b36",
  boxShadow: "0 2px 8px 0 rgba(30,35,48,0.04)",
  width: 200,
  minHeight: 130,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  position: "relative",
  padding: 18,
  transition: "border 0.17s",
};
const fileCardStyle = {
  background: "#19202A",
  borderRadius: 22,
  border: "2.2px solid #232b36",
  boxShadow: "0 2px 8px 0 rgba(30,35,48,0.04)",
  width: 200,
  minHeight: 98,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  position: "relative",
  padding: 18,
  marginTop: 12,
};
const deleteBtnStyle = {
  position: "absolute",
  top: 8,
  right: 8,
  background: "none",
  border: "none",
  color: "#FFD600",
  cursor: "pointer",
  fontSize: 18,
  padding: 2,
};
const renameBtnStyle = {
  background: "none",
  border: "none",
  color: "#FFD600",
  marginLeft: 6,
  cursor: "pointer",
  fontSize: 17,
};
const renameInputStyle = {
  fontSize: 18,
  borderRadius: 6,
  border: "1.2px solid #FFD600",
  padding: "4px 10px",
  width: 95,
  marginRight: 4,
};
const renameIconBtn = {
  background: "none",
  border: "none",
  color: "#FFD600",
  fontSize: 18,
  cursor: "pointer",
  marginLeft: 2,
};
const modalStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.37)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const modalBoxStyle = {
  background: "#22293c",
  borderRadius: 18,
  padding: "28px 38px",
  minWidth: 320,
  minHeight: 60,
  boxShadow: "0 4px 26px #0005",
  display: "flex",
  flexDirection: "column",
  alignItems: "center"
};
const modalBtnStyle = {
  background: "#FFD600",
  color: "#181d24",
  fontWeight: 700,
  padding: "8px 22px",
  borderRadius: 9,
  border: "none",
  cursor: "pointer",
  fontSize: 17,
};
const modalBtnAltStyle = {
  background: "none",
  color: "#FFD600",
  fontWeight: 700,
  padding: "8px 22px",
  borderRadius: 9,
  border: "1.2px solid #FFD600",
  cursor: "pointer",
  fontSize: 17,
};
const inputStyle = {
  padding: "12px 15px",
  borderRadius: 7,
  border: "none",
  width: 220,
  fontSize: 18,
  background: "#fff",
  color: "#181d24",
  fontWeight: 600,
  marginBottom: 10,
  marginTop: 3,
};
const confirmModalStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.32)",
  zIndex: 2000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const confirmBoxStyle = {
  background: "#fff",
  borderRadius: 11,
  padding: "18px 30px",
  minWidth: 170,
  minHeight: 40,
  boxShadow: "0 4px 26px #0004",
  display: "flex",
  flexDirection: "column",
  alignItems: "center"
};