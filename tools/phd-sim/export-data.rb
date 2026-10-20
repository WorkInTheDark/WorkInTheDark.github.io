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

# Translation tables (_data/phd_sim_i18n/<lang>/*.yml), the same shape Jekyll renders at
# /assets/phd-sim/i18n-<lang>.json: { source: [{ en, <lang> }] }.
i18n_dir = File.join(root, "_data", "phd_sim_i18n")
if Dir.exist?(i18n_dir)
  Dir.children(i18n_dir).sort.each do |lang|
    dir = File.join(i18n_dir, lang)
    next unless File.directory?(dir)
    tree = load_tree(dir)
    flat = {}
    walk = lambda do |t, prefix|
      t.each { |k, v| v.is_a?(Hash) ? walk.call(v, prefix + k + "/") : flat[prefix + k] = v }
    end
    walk.call(tree, "")
    path = File.join(File.dirname(out_path), "i18n-#{lang}.json")
    File.write(path, JSON.generate(flat))
    done = flat.values.flatten.count { |r| r.is_a?(Hash) && r[lang].to_s.strip != "" }
    total = flat.values.flatten.count { |r| r.is_a?(Hash) }
    puts "wrote #{path} (#{File.size(path) / 1024} KB, #{done} of #{total} strings translated)"
  end
end
