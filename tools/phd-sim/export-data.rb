#!/usr/bin/env ruby
# Exports _data/phd_sim (and the PhD 101 topic map) to JSON with the same shape that
# Jekyll renders into assets/phd-sim/data.json, so the Node tools and the dev page can run
# without a full site build.
#   ruby tools/phd-sim/export-data.rb [output.json]
Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8
require "yaml"
require "json"
require "date"

root = File.expand_path("../..", __dir__)
data_dir = File.join(root, "_data", "phd_sim")
out_path = ARGV[0] || File.join(__dir__, "out", "data.json")

def load_tree(dir)
  tree = {}
  Dir.children(dir).sort.each do |name|
    path = File.join(dir, name)
    if File.directory?(path)
      tree[name] = load_tree(path)
    elsif name =~ /\.ya?ml\z/
      tree[name.sub(/\.ya?ml\z/, "")] = YAML.safe_load(File.read(path), permitted_classes: [Date], aliases: true)
    end
  end
  tree
end

phd101 = {}
Dir.glob(File.join(root, "_phd101", "*.md")).sort.each do |f|
  text = File.read(f)
  next unless text =~ /\A---\s*\n(.*?)\n---/m
  fm = YAML.safe_load($1, permitted_classes: [Date]) || {}
  next unless fm["topic"]
  phd101[fm["topic"].to_s] = { "title" => fm["title"].to_s, "url" => "/phd101/#{File.basename(f, ".md")}/" }
end

payload = { "phd101" => phd101, "data" => load_tree(data_dir) }
File.write(out_path, JSON.generate(payload))
puts "wrote #{out_path} (#{File.size(out_path) / 1024} KB, #{phd101.size} PhD 101 topics)"
