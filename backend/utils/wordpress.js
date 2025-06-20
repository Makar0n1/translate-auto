const axios = require('axios');
const Domain = require('../models/Domain');

const getWpClient = async (domainId) => {
  const domain = await Domain.findById(domainId);
  if (!domain || !domain.isWordPress) throw new Error('Invalid WordPress domain');
  return axios.create({
    baseURL: `${domain.url}`,
    auth: {
      username: domain.login,
      password: domain.apiPassword
    }
  });
};

exports.getPostByUrl = async (postId, domainId) => {
  try {
    const wpClient = await getWpClient(domainId);
    console.log(`Fetching post for ID: ${postId}, domainId: ${domainId}`);

    // Поиск только по ID через /film/<id>
    console.log(`Fetching from /film/${postId}`);
    const response = await wpClient.get(`/film/${postId}`);
    console.log(`Response from /film/${postId}:`, response.data);
    if (response.data.id) {
      console.log(`Found CPT post with ID: ${response.data.id}, slug: ${response.data.slug}`);
      return { ...response.data, type: 'film' };
    }

    throw new Error(`Post not found for ID: ${postId}`);
  } catch (error) {
    console.error(`Error fetching post for ID ${postId}:`, error.message, error.response?.data || '');
    throw error;
  }
};

exports.updatePost = async (postId, data, domainId, postType = 'film') => {
  try {
    const wpClient = await getWpClient(domainId);
    const endpoint = postType === 'film' ? `/film/${postId}` : `/posts/${postId}`;
    console.log(`Updating post ${postId} with data:`, data, `at endpoint: ${endpoint}`);
    const response = await wpClient.post(endpoint, {
      content: data.content,
      meta: data.meta || {},
      yoast_head: data.yoast_head || undefined
    });
    console.log(`Updated post ${postId} at endpoint ${endpoint}, response:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error updating post ${postId}:`, error.message, error.response?.data || '');
    throw error;
  }
};