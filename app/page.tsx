'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Folder, Plus, MoreVertical, Edit2, Trash2, FolderInput, BookOpen, Clock, Tag, Database, Loader2 } from 'lucide-react';

type Collection = { id: string; name: string };
type Story = { id: string; title: string; tags: string[]; collection_id: string | null; updated_at: string };

export default function LibraryPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  
  // Modals
  const [isNewStoryModalOpen, setIsNewStoryModalOpen] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryTags, setNewStoryTags] = useState('');
  const [isCreatingStory, setIsCreatingStory] = useState(false);
  const [storyError, setStoryError] = useState('');
  
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [collectionError, setCollectionError] = useState('');

  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [editStoryTitle, setEditStoryTitle] = useState('');
  const [editStoryTags, setEditStoryTags] = useState('');
  const [editStoryCollection, setEditStoryCollection] = useState<string | null>(null);
  const [isUpdatingStory, setIsUpdatingStory] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [colRes, storyRes] = await Promise.all([
          fetch('/api/collections'),
          fetch('/api/stories')
        ]);
        const colData = await colRes.json();
        const storyData = await storyRes.json();
        
        if (colData.collections) setCollections(colData.collections);
        if (storyData.stories) setStories(storyData.stories);
      } catch (err) {
        console.error('Failed to fetch data', err);
      }
    };
    fetchData();
  }, []);

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    setIsCreatingCollection(true);
    setCollectionError('');
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName })
      });
      const data = await res.json();
      if (data.collection) {
        setCollections([data.collection, ...collections]);
        setIsNewCollectionModalOpen(false);
        setNewCollectionName('');
      } else if (data.error) {
        setCollectionError(data.error);
      }
    } catch (err: any) {
      setCollectionError(err.message || 'Failed to create collection');
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleCreateStory = async () => {
    if (!newStoryTitle.trim()) return;
    setIsCreatingStory(true);
    setStoryError('');
    const tagsArray = newStoryTags.split(',').map(t => t.trim()).filter(t => t);
    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newStoryTitle, 
          tags: tagsArray, 
          collection_id: activeCollection 
        })
      });
      const data = await res.json();
      if (data.story) {
        setStories([data.story, ...stories]);
        setIsNewStoryModalOpen(false);
        setNewStoryTitle('');
        setNewStoryTags('');
        router.push(`/editor/${data.story.id}`);
      } else if (data.error) {
        setStoryError(data.error);
      }
    } catch (err: any) {
      setStoryError(err.message || 'Failed to create story');
    } finally {
      setIsCreatingStory(false);
    }
  };

  const handleUpdateStory = async () => {
    if (!editingStory || !editStoryTitle.trim()) return;
    setIsUpdatingStory(true);
    const tagsArray = editStoryTags.split(',').map(t => t.trim()).filter(t => t);
    try {
      const res = await fetch(`/api/stories/${editingStory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: editStoryTitle, 
          tags: tagsArray,
          collection_id: editStoryCollection
        })
      });
      const data = await res.json();
      if (data.story) {
        setStories(stories.map(s => s.id === data.story.id ? data.story : s));
        setEditingStory(null);
      } else if (data.error) {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsUpdatingStory(false);
    }
  };

  const handleDeleteStory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this story?')) return;
    try {
      await fetch(`/api/stories/${id}`, { method: 'DELETE' });
      setStories(stories.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete story', err);
    }
  };

  const filteredStories = activeCollection 
    ? stories.filter(s => s.collection_id === activeCollection)
    : stories;

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-300 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-[#111] border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <h1 className="text-xl font-medium tracking-tight text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Library
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workspaces</h2>
              <button 
                onClick={() => setIsNewCollectionModalOpen(true)}
                className="text-gray-400 hover:text-white transition-colors"
                title="New Collection"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setActiveCollection(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    activeCollection === null ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-white/5'
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  All Stories
                </button>
              </li>
              {collections.map(col => (
                <li key={col.id}>
                  <button
                    onClick={() => setActiveCollection(col.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      activeCollection === col.id ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-white/5'
                    }`}
                  >
                    <Folder className="w-4 h-4" />
                    {col.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
             <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Local</h2>
             <button
                onClick={() => router.push('/editor/local')}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-white/5 transition-colors"
              >
                <Database className="w-4 h-4" />
                Local Memory (memory.json)
              </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#111]/50">
          <div>
            <h2 className="text-2xl font-medium text-white">
              {activeCollection ? collections.find(c => c.id === activeCollection)?.name : 'All Stories'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{filteredStories.length} stories</p>
          </div>
          <button
            onClick={() => setIsNewStoryModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New Story
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStories.map(story => (
              <div 
                key={story.id} 
                className="group bg-[#1a1a1a] border border-white/5 rounded-xl p-5 hover:border-indigo-500/50 transition-all cursor-pointer flex flex-col"
                onClick={() => router.push(`/editor/${story.id}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-white line-clamp-2 leading-tight">{story.title}</h3>
                  <div className="relative flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button 
                      className="text-gray-500 hover:text-white p-1 rounded-md hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setEditingStory(story);
                        setEditStoryTitle(story.title);
                        setEditStoryTags(story.tags?.join(', ') || '');
                        setEditStoryCollection(story.collection_id);
                      }}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <button 
                      className="text-gray-500 hover:text-red-500 p-1 rounded-md hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteStory(story.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {story.tags && story.tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 text-xs text-gray-400">
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                  {(!story.tags || story.tags.length === 0) && (
                    <span className="text-xs text-gray-600 italic">No tags</span>
                  )}
                </div>
                
                <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(story.updated_at).toLocaleDateString()}
                  </div>
                  {story.collection_id && (
                    <div className="flex items-center gap-1">
                      <Folder className="w-3 h-3" />
                      {collections.find(c => c.id === story.collection_id)?.name}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {filteredStories.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <BookOpen className="w-12 h-12 mb-4 opacity-20" />
              <p>No stories found in this collection.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Story Modal */}
      {isNewStoryModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">Create New Story</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                <input 
                  type="text" 
                  value={newStoryTitle}
                  onChange={e => setNewStoryTitle(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g., Cyberpunk Detective"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={newStoryTags}
                  onChange={e => setNewStoryTags(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g., Sci-Fi, Mystery, Cyberpunk"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              {storyError && <p className="text-red-400 text-xs self-center mr-auto">{storyError}</p>}
              <button 
                onClick={() => setIsNewStoryModalOpen(false)}
                disabled={isCreatingStory}
                className="px-4 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateStory}
                disabled={isCreatingStory || !newStoryTitle.trim()}
                className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isCreatingStory ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isCreatingStory ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {isNewCollectionModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">Create Workspace</h3>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
              <input 
                type="text" 
                value={newCollectionName}
                onChange={e => setNewCollectionName(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="e.g., Personal Projects"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              {collectionError && <p className="text-red-400 text-xs self-center mr-auto">{collectionError}</p>}
              <button 
                onClick={() => setIsNewCollectionModalOpen(false)}
                disabled={isCreatingCollection}
                className="px-4 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateCollection}
                disabled={isCreatingCollection || !newCollectionName.trim()}
                className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isCreatingCollection ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isCreatingCollection ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Story Modal */}
      {editingStory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">Edit Story</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                <input 
                  type="text" 
                  value={editStoryTitle}
                  onChange={e => setEditStoryTitle(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={editStoryTags}
                  onChange={e => setEditStoryTags(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Workspace</label>
                <select 
                  value={editStoryCollection || ''}
                  onChange={e => setEditStoryCollection(e.target.value || null)}
                  className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">None</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
              <button 
                onClick={() => handleDeleteStory(editingStory.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => setEditingStory(null)}
                  disabled={isUpdatingStory}
                  className="px-4 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateStory}
                  disabled={isUpdatingStory || !editStoryTitle.trim()}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isUpdatingStory ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isUpdatingStory ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
